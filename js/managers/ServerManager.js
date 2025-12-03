export default class ServerManager {

    constructor() {
        this.SERVER_URL = "http://twserver.alunos.dcc.fc.up.pt:8008/";
        this.GROUP_ID = 10;

        this.state = {
            active: false,
            gameId: null,
            nick: null,
            pass: null,
            eventSource: null,
            color: null
        };
    }

    // ------------------ GENERIC POST REQUEST ------------------

    async request(endpoint, params) {
        const url = this.SERVER_URL + endpoint;
        const options = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(params)
        };

        try {
            const r = await fetch(url, options);
            const data = await r.json();
            if (!r.ok) throw new Error(data.error || 'Erro no servidor');
            return data;
        } catch (err) {
            console.error(`Erro em ${endpoint}:`, err);
            throw err;
        }
    }

    // ------------------ REGISTER / LOGIN ------------------

    async register(nick, password) {
        const nickStr = String(nick);
        const passStr = String(password);
        return this.request("register", { nick: nickStr, password: passStr });
    }

    async login(nick, password) {
        // O servidor usa o endpoint register para login também
        return this.register(nick, password);
    }

    // ------------------ JOIN GAME ------------------

    async join(group, nick, password, size) {
        const data = { group, nick, password, size };
        const result = await this.request("join", data);

        if (!result.game) throw new Error("Join falhou – sem game ID");

        this.state.nick = data.nick;
        this.state.pass = data.password;
        this.state.gameId = result.game;
        this.state.active = true;

        return result;
    }

    // ------------------ SSE - UPDATE ------------------

    startListening(nick, gameId, onMessage, onError) {
        this.stopListening(); // Fecha anterior

        const url =
            `${this.SERVER_URL}update?nick=${encodeURIComponent(nick)}&game=${encodeURIComponent(gameId)}`;

        this.state.eventSource = new EventSource(url);

        this.state.eventSource.onmessage = (event) => {
            if (!event.data) return;

            // Cada linha pode ser um JSON separado
            const lines = event.data.trim().split("\n");
            for (const line of lines) {
                try {
                    const data = JSON.parse(line);
                    onMessage(data);
                } catch (e) {
                    console.error("Erro a processar update SSE:", e, line);
                }
            }
        };

        this.state.eventSource.onerror = (error) => {
            console.error("Erro SSE:", error);
            if (onError) onError(error);
        };
    }

    stopListening() {
        if (this.state.eventSource) {
            this.state.eventSource.close();
            this.state.eventSource = null;
        }
    }

    // ------------------ SERVER COMMANDS ------------------

    async leave(nick, password, game) {
        return this.request('leave', { nick, password, game });
    }

    async roll(nick, password, game) {
        return this.request('roll', { nick, password, game });
    }

    async notify(nick, password, game, move) {
        return this.request('notify', { nick, password, game, move });
    }

    async ranking(size) {
        return this.request("ranking", { group: this.GROUP_ID, size });
    }

    // ------------------ STATE UTILS ------------------

    setCredentials(nick, pass) {
        this.state.nick = nick;
        this.state.pass = pass;
    }

    setGame(gameId) {
        this.state.gameId = gameId;
        this.state.active = true;
    }

    clearGame() {
        this.state.active = false;
        this.state.gameId = null;
        this.stopListening();
    }
}
