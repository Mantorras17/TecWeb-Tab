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
        const data = { group, nick, password, size }
        const result = await this.request("join", data);

        if (!result.game) throw new Error("Join falhou – sem game ID");

        this.state.nick = data.nick;
        this.state.pass = data.password;
        this.state.gameId = result.game;
        this.state.active = true;

        return result;
    }

    // ------------------ SSE - UPDATE ------------------

    update(game, nick, onMessage) {
        // Fecha qualquer ligação anterior
        this.closeUpdate();

        const url =
            `${this.SERVER_URL}update?game=${encodeURIComponent(game)}&nick=${encodeURIComponent(nick)}`;

        const eventSource = new EventSource(url);
        this.state.eventSource = eventSource;

        eventSource.onmessage = (event) => {
            if (!event.data) return;
            try {
                const data = JSON.parse(event.data);

                // O GUIÃO diz que o servidor envia step, turn, pieces.
                if (data.step) this.state.step = data.step;
                if (data.turn) this.state.turn = data.turn;
                if (data.pieces) this.state.pieces = data.pieces;

                if (onMessage) onMessage(data);
            } catch (e) {
                console.error("Erro a processar SSE:", e);
            }
        };

        eventSource.onerror = (error) => {
            console.error("Erro SSE (game inválido?):", error);
        };
    }

    closeUpdate() {
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

    async notify(nick, password, game, cell) {
        return this.request('notify', { nick, password, game, cell });
    }

    async ranking(group, size) {
        return this.request('ranking', { group, size });
    }

    async pass(nick, password, game) { 
        return this.request('pass', {nick, password, game });
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
        this.closeUpdate();
    }
}
