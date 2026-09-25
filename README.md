# Final Project - Playwright Automation Testing

## Change Password (In-App)

Final project ini merupakan implementasi **automated testing menggunakan Playwright + TypeScript** untuk fitur **Change Password (In-App)**.

Automation dibuat berdasarkan test case dan requirement yang telah ditentukan untuk memvalidasi behavior fitur Change Password melalui **Web UI Testing** dan **API Testing**.

Project juga diintegrasikan dengan **GitHub Actions** untuk menjalankan automated test pada CI serta menghasilkan **Playwright HTML Report** sebagai evidence hasil testing.

---

## 🛠 Tech Stack

## 🛠 Tech Stack & Tools

- Playwright
- TypeScript
- Node.js
- Page Object Model (POM)
- Playwright MCP
- AgentQ MCP
- AgentQ Test Case Management
- Git & GitHub
- GitHub Actions
- Docker
- Playwright HTML Reporter

---

## 🤖 MCP Integration

Project ini juga menggunakan **Model Context Protocol (MCP)** untuk mendukung proses development, testing, dan integrasi dengan Test Case Management.

MCP yang digunakan pada project ini:

### 🎭 Playwright MCP

**Playwright MCP** digunakan untuk membantu proses development dan debugging automation testing pada aplikasi web.

Penggunaannya pada project ini mencakup:

- Membantu melakukan browser interaction
- Membantu melakukan investigasi UI behavior
- Membantu validasi locator dan element
- Membantu debugging test scenario
- Membantu observasi actual behavior aplikasi
- Mendukung proses pembuatan dan pengembangan Playwright automation

Automation final tetap diimplementasikan menggunakan **Playwright + TypeScript** dan dapat dijalankan secara independen menggunakan:

```bash
npx playwright test
```

---

### 🧪 AgentQ MCP

**AgentQ MCP** digunakan untuk menghubungkan automation testing dengan **Test Case Management**.

Test case Change Password dikelola pada AgentQ dengan ID:

```text
CP-001 – CP-029
```

Integrasi AgentQ digunakan untuk membantu melakukan update hasil execution berdasarkan hasil automation.

Status test case yang digunakan antara lain:

```text
passed
failed
blocked
skipped
not_run
```

Secara konseptual workflow integrasinya:

```text
Test Case Management (AgentQ)
            ↓
       CP-001 – CP-029
            ↓
Playwright Automation Execution
            ↓
     Actual Test Result
            ↓
        AgentQ MCP
            ↓
Update Test Execution Result
```

Dengan integrasi ini, hasil automation dapat dikaitkan kembali dengan test case yang terdapat pada Test Case Management.

---

## 🔄 Automation Workflow

Workflow keseluruhan pada final project ini:

```text
Requirement / RFC
        ↓
Test Case Design
        ↓
AgentQ Test Case Management
        ↓
Playwright Automation
        ↓
Web UI + API Testing
        ↓
Password Recovery / State Verification
        ↓
Test Execution
        ↓
AgentQ MCP
        ↓
Test Result Update
        ↓
GitHub Actions
        ↓
Playwright HTML Report
        ↓
QA Defect Report & Sign-Off
```

MCP digunakan sebagai supporting integration dalam development dan test management, sedangkan automated test utama tetap berada di source code project dan dapat dijalankan melalui local environment maupun GitHub Actions.

---

## 📌 Test Scope

Automation mencakup pengujian fitur **Change Password (In-App)** dari sisi Web UI dan API.

Total test case:

| Scope | Test Case |
|---|---:|
| Web UI Testing | CP-001 – CP-013 |
| API Testing | CP-014 – CP-029 |
| **Total** | **29 Test Cases** |

Coverage utama meliputi:

- Successful password change
- Required field validation
- Password strength validation
- Incorrect current password
- Session behavior after password change
- Login menggunakan password baru
- Login menggunakan password lama
- Unauthorized access
- API authentication
- Minimum password length
- Maximum password length
- Uppercase validation
- Lowercase validation
- Numeric validation
- Password confirmation mismatch
- Password tanpa special character
- New password sama dengan current password

---

## 📁 Project Structure

```text
.
├── .github/
│   └── workflows/
│       ├── playwright.yml
│       └── build-docker.yml
│
├── data/
│   ├── user.json
│   └── user.example.json
│
├── docs/
│   ├── defects/
│   └── reports/
│
├── helpers/
│   ├── auth.ts
│   ├── config.ts
│   └── password-recovery.ts
│
├── pages/
│   ├── change-password.page.ts
│   └── login.page.ts
│
├── tests/
│   ├── api/
│   │   └── change-password.api.spec.ts
│   └── change-password.spec.ts
│
├── Dockerfile
├── package.json
├── package-lock.json
├── playwright.config.ts
└── README.md
```

---

## 🧪 Test Design

### Web UI Automation

Web automation menggunakan pendekatan **Page Object Model (POM)** untuk memisahkan locator dan interaction logic dari test scenario.

File utama:

```text
pages/login.page.ts
pages/change-password.page.ts
tests/change-password.spec.ts
```

### API Automation

API automation digunakan untuk melakukan validasi langsung terhadap endpoint Change Password.

File utama:

```text
tests/api/change-password.api.spec.ts
```

Endpoint utama yang diuji:

```http
POST /api/v1/auth/change_password
```

API test mencakup positive, negative, authentication, validation, boundary, dan password policy scenarios.

---

## 🔐 Password Recovery Mechanism

Karena Change Password merupakan **state-changing test**, automation dilengkapi mekanisme password recovery.

Helper:

```text
helpers/password-recovery.ts
```

Recovery digunakan untuk membantu mengembalikan account ke original password setelah test yang melakukan perubahan password.

State yang digunakan antara lain:

```text
ORIGINAL_ACTIVE
TEMPORARY_ACTIVE
UNKNOWN
```

Automation juga melakukan verifikasi credential setelah recovery untuk memastikan state account sebelum test berikutnya dijalankan.

---

## ⚙️ Playwright Configuration

Konfigurasi utama berada di:

```text
playwright.config.ts
```

Execution menggunakan:

```text
Browser        : Chromium
Workers        : 1
Retries        : 0
Parallel       : Disabled
Reporter       : HTML
```

Test dijalankan secara sequential karena beberapa scenario melakukan perubahan terhadap state password account.

Trace, screenshot, dan video dinonaktifkan untuk mengurangi risiko authentication/password data tersimpan pada artifact automation.

---

## ▶️ Installation

Clone repository:

```bash
git clone git@github.com:restinf21/Final-project-automation-playwright-change-password.git
```

Masuk ke project:

```bash
cd Final-project-automation-playwright-change-password
```

Install dependencies:

```bash
npm ci
```

Install Playwright browser:

```bash
npx playwright install
```

---

## ▶️ Running Tests

Menjalankan seluruh automation:

```bash
npx playwright test
```

Menjalankan Web UI test:

```bash
npx playwright test tests/change-password.spec.ts
```

Menjalankan API test:

```bash
npx playwright test tests/api/change-password.api.spec.ts
```

Menampilkan HTML report:

```bash
npx playwright show-report
```

---

## 🚀 GitHub Actions

Project telah diintegrasikan dengan **GitHub Actions** melalui:

```text
.github/workflows/playwright.yml
```

Workflow akan dijalankan ketika terdapat:

```text
push → main/master
pull request → main/master
```

Pipeline menjalankan proses:

```text
Checkout Repository
        ↓
Setup Node.js
        ↓
Install Dependencies
        ↓
Install Playwright Browser
        ↓
Run Playwright Tests
        ↓
Generate Playwright HTML Report
        ↓
Upload Report Artifact
```

Playwright report disimpan sebagai GitHub Actions artifact:

```text
playwright-report
```

---

## 🐳 Docker

Project juga menyediakan Docker configuration:

```text
Dockerfile
.github/workflows/build-docker.yml
```

Docker base image berisi Node.js, project dependencies, dan Playwright browser dependencies yang dibutuhkan untuk automation environment.

Workflow Docker dapat dijalankan secara manual melalui:

```text
GitHub
→ Actions
→ Build Base Docker Image
→ Run workflow
```

---

## 📊 Test Execution Result

GitHub Actions berhasil mengeksekusi seluruh **29 test cases**.

Hasil execution:

| Status | Total |
|---|---:|
| ✅ Passed | 7 |
| ❌ Failed | 21 |
| ⏭️ Skipped | 1 |
| **Total** | **29** |

> **Note:** Status GitHub Actions ditampilkan sebagai `Failure` karena terdapat automated test yang menghasilkan assertion failure. Failure tersebut merupakan hasil validasi terhadap actual application behavior yang tidak sesuai dengan expected result pada test case, bukan karena test suite gagal dieksekusi.

Expected result pada automation **tidak diubah hanya untuk membuat pipeline menjadi passed**.

---

## 🐞 Key Findings

Beberapa finding utama dari automation execution:

### 1. Change Password UI menggunakan flow/endpoint yang tidak sesuai

Web Change Password tidak menghasilkan behavior sesuai endpoint Change Password yang diharapkan.

### 2. Required field validation tidak sesuai requirement

Required validation pada beberapa field belum menampilkan field-specific inline validation sesuai expected behavior.

### 3. Error handling pada UI tidak selalu menggunakan API error

Pada beberapa scenario, UI menampilkan custom error message yang berbeda dari error API.

### 4. Change Password API menghasilkan HTTP 500

Beberapa request Change Password menghasilkan:

```text
HTTP 500 Internal Server Error
```

meskipun pada beberapa scenario password ternyata telah berubah.

### 5. Password policy belum sepenuhnya enforced

Beberapa invalid password scenario masih dapat mengubah password meskipun seharusnya ditolak berdasarkan password policy.

---

## 📄 QA Documentation

Dokumentasi hasil QA tersedia pada folder:

```text
docs/
```

Dokumentasi mencakup:

```text
docs/defects/
docs/reports/
```

Di dalamnya terdapat defect report, test execution summary, dan QA sign-off untuk hasil pengujian Change Password.

---

## 📈 Test Report Evidence

Playwright HTML Report dihasilkan setelah automation execution.

Pada GitHub Actions, report dapat ditemukan melalui:

```text
Actions
→ Playwright Tests
→ Workflow Run
→ Artifacts
→ playwright-report
```

Report tersebut dapat digunakan sebagai evidence execution automated testing.

---

## ⚠️ Important Notes

Automation ini melakukan perubahan password pada test account.

Untuk mengurangi risiko state account tidak konsisten:

- Test dijalankan menggunakan `workers: 1`
- Parallel execution dinonaktifkan
- Password recovery mechanism digunakan
- Credential state diverifikasi setelah recovery
- Test account yang digunakan harus merupakan dedicated QA/test account

Failed test tidak secara otomatis berarti automation script bermasalah. Assertion failure dapat menunjukkan bahwa **actual application behavior berbeda dari expected result** yang ditentukan oleh requirement/test case.

---

## 📌 Final Result

Final project berhasil mengimplementasikan:

- Web UI Automation Testing
- API Automation Testing
- Page Object Model
- Authentication Helper
- Password Recovery Mechanism
- Positive & Negative Testing
- Boundary Testing
- Password Policy Testing
- Playwright MCP Integration
- AgentQ MCP & Test Case Management Integration
- GitHub Actions CI
- Playwright HTML Report
- Docker Configuration
- Defect Documentation
- Test Execution Summary
- QA Sign-Off

Automation berhasil dijalankan melalui GitHub Actions untuk seluruh **29 test cases**, dengan hasil akhir:

```text
7 Passed
21 Failed
1 Skipped
29 Total

Hasil failure dipertahankan sesuai actual behavior aplikasi dan didokumentasikan sebagai bagian dari QA findings.

---

## 👩‍💻 Author

**Resti Noor Fahmi**  
Quality Assurance Engineer  
Final Project - Automation Testing with Playwright