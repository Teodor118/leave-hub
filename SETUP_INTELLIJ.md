# Cum rulezi Employee Leave Hub local în IntelliJ IDEA

Ghid pas cu pas pentru a copia proiectul din Emergent și a-l rula pe calculatorul tău.

---

## 1. Cerințe preliminare (instalează o singură dată)

- **Python 3.11+** — https://www.python.org/downloads/
- **Node.js 20+** și **Yarn** — https://nodejs.org/ apoi `npm install -g yarn`
- **MongoDB Community** (rulează local) — https://www.mongodb.com/try/download/community
  - Alternativă mai ușoară: **MongoDB Atlas** gratuit (cloud) — https://www.mongodb.com/atlas
- **IntelliJ IDEA Ultimate** (are Python + JavaScript out-of-the-box)
  - Sau IntelliJ Community + plugin-uri: `Python Community Edition`, `JavaScript and TypeScript`

---

## 2. Structura proiectului

```
leave-hub/
├── backend/
│   ├── .env
│   ├── requirements.txt
│   └── server.py
└── frontend/
    ├── .env
    ├── package.json
    ├── craco.config.js
    ├── jsconfig.json
    ├── postcss.config.js
    ├── tailwind.config.js
    ├── components.json
    ├── public/
    └── src/
        ├── App.css
        ├── App.js
        ├── index.css
        ├── index.js
        ├── components/       (Layout, PageHeader, LeaveRequestFormDialog + ui/)
        ├── context/          (AuthContext.jsx)
        ├── hooks/            (use-toast.js)
        ├── lib/              (api.js, utils.js)
        └── pages/            (Login, Dashboard, MyRequests, ...)
```

---

## 3. Descărcarea codului din Emergent

Ai două opțiuni în platforma Emergent:

### Opțiunea A — Push în GitHub (recomandat)
1. În Emergent, apasă pe icoana **GitHub** din meniul lateral.
2. Autorizează Emergent să acceseze contul tău GitHub.
3. Alege numele repo-ului (ex. `leave-hub`) și apasă **Push to GitHub**.
4. Local: `git clone https://github.com/<user>/leave-hub.git`

### Opțiunea B — Download ZIP
1. În meniul Emergent (dreapta sus, "..."), alege **Download code**.
2. Salvezi arhiva `.zip` și o dezarhivezi într-un folder (ex. `C:\proiecte\leave-hub`).

---

## 4. Deschide proiectul în IntelliJ IDEA

1. **File → Open** → alege folderul `leave-hub` (nu backend sau frontend separat).
2. IntelliJ va indexa fișierele.
3. **File → Project Structure → SDKs** → verifică Python 3.11 și Node.js.
4. Dacă vezi o notificare “Add Python Interpreter”, o folosim la pasul 5.

---

## 5. Backend — configurare și pornire

### 5.1 Deschide un Terminal în IntelliJ (Alt+F12) și intră în backend:
```bash
cd backend
```

### 5.2 Creează un virtualenv Python:
```bash
python -m venv venv
# Windows PowerShell:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate
```

### 5.3 Instalează dependențele:
```bash
pip install -r requirements.txt
pip install reportlab  # dacă nu apare în requirements
```

### 5.4 Configurează `.env` (există deja, dar verifică):
```
MONGO_URL="mongodb://localhost:27017"
DB_NAME="leave_hub"
CORS_ORIGINS="http://localhost:3000"
JWT_SECRET="pune-aici-un-string-random-lung"
ADMIN_EMAIL="ragemonster069@gmail.com"
ADMIN_PASSWORD="admin123"
```
> Dacă folosești MongoDB Atlas: înlocuiește `MONGO_URL` cu connection string-ul din Atlas.

### 5.5 Pornește serverul FastAPI:
```bash
uvicorn server:app --reload --port 8001
```
Backend-ul rulează la **http://localhost:8001** cu documentație Swagger la **http://localhost:8001/docs**.

### 5.6 (Opțional) Rulează din IntelliJ:
- **Run → Edit Configurations → + Python**
- Module name: `uvicorn`
- Parameters: `server:app --reload --port 8001`
- Working directory: `<proiect>/backend`
- Salvezi și apeși ▶.

---

## 6. Frontend — configurare și pornire

### 6.1 Într-un al doilea terminal:
```bash
cd frontend
```

### 6.2 Instalează dependențele (**folosește yarn, NU npm**):
```bash
yarn install
```

### 6.3 Configurează `.env`:
```
REACT_APP_BACKEND_URL=http://localhost:8001
WDS_SOCKET_PORT=0
```
> **Important**: `REACT_APP_BACKEND_URL` trebuie să indice către backend-ul tău local (fără `/api` la final — codul îl adaugă automat).

### 6.4 Pornește frontend-ul:
```bash
yarn start
```
Se deschide automat la **http://localhost:3000**.

---

## 7. Verificare rapidă

1. Deschide http://localhost:3000
2. Autentifică-te cu:
   - **Admin**: ragemonster069@gmail.com / admin123
   - **Manager IT**: manager.it@draxlmaier.ro / parola123
   - **Angajat**: ion.popescu@draxlmaier.ro / parola123
3. La prima pornire backend-ul creează automat: 4 departamente, 4 tipuri concediu, 3 manageri, 5 angajați.

---

## 8. Sfaturi utile pentru IntelliJ

- **Run configurations dual**: Creează 2 configurații (Backend uvicorn + Frontend `yarn start`) și pornește-le împreună cu **Run → Compound**.
- **Formatter Python**: instalează Black — `pip install black` — și activează-l în Settings → Tools → Black.
- **Lint frontend**: proiectul are ESLint deja configurat.
- **MongoDB browser**: instalează **MongoDB Compass** (https://www.mongodb.com/products/compass) să vezi colecțiile (`users`, `leave_requests`, etc.).
- **Environment variables** pentru IntelliJ Run Config: nu comita niciodată `.env` cu secrete reale în GitHub. Adaugă-l în `.gitignore` (deja este).

---

## 9. Probleme frecvente

| Problemă | Soluție |
|----------|---------|
| `Module not found: '@/lib/utils'` | Verifică că există `frontend/src/lib/utils.js` cu funcția `cn` |
| Frontend nu se conectează la API | Verifică `REACT_APP_BACKEND_URL` în `.env` și că backend rulează pe portul 8001 |
| Eroare CORS | Adaugă `http://localhost:3000` în `CORS_ORIGINS` din backend `.env` și restart uvicorn |
| MongoDB refuză conexiunea | Pornește serviciul MongoDB: `net start MongoDB` (Windows) sau `brew services start mongodb-community` (macOS) |
| `yarn: command not found` | `npm install -g yarn` |
| Portul 3000 sau 8001 ocupat | Schimbă în comandă: `--port 8002` (backend) sau `PORT=3001 yarn start` (frontend) |

---

## 10. Rulare completă în 4 comenzi

Odată ce ai instalat totul, pentru pornirile ulterioare:

```bash
# Terminal 1 — Backend
cd backend && source venv/bin/activate && uvicorn server:app --reload --port 8001

# Terminal 2 — Frontend
cd frontend && yarn start
```

Gata. Aplicația e disponibilă la http://localhost:3000.
