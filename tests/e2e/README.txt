Playwright E2E

1) Backend starten (Port 8080):
   python backend/server.py

2) Im Projektordner installieren:
   npm install
   npx playwright install

3) Test ausfuehren:
   npm run test:e2e:preview

Optional anderes Ziel:
   E2E_BASE_URL=http://127.0.0.1:8000 npm run test:e2e:preview
