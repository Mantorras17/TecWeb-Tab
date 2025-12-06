#!/bin/bash
# test-phase3.sh

echo "=== Testing Phase 3 ==="

echo -e "\n1. Register players..."
curl -s -X POST http://localhost:8110/register -H "Content-Type: application/json" -d '{"nick":"alice","password":"123"}'
curl -s -X POST http://localhost:8110/register -H "Content-Type: application/json" -d '{"nick":"bob","password":"456"}'

echo -e "\n2. Check rankings..."
curl -s -X POST http://localhost:8110/ranking -H "Content-Type: application/json" -d '{"group":1,"size":9}'

echo -e "\n3. Test error - wrong password..."
curl -s -X POST http://localhost:8110/register -H "Content-Type: application/json" -d '{"nick":"alice","password":"wrong"}'

echo -e "\n✓ All tests completed!"