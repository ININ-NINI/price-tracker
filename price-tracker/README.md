# 생활물가 대시보드

일상생활에서 사용하는 상품들의 가격을 추적하고 변화를 모니터링할 수 있는 웹 애플리케이션입니다.

## 기능

- ✅ 상품명과 가격 입력
- ✅ 가격 변화 추적 (상승/하락 표시)
- ✅ 데이터 삭제 기능
- ✅ 반응형 디자인
- ✅ 다크 모드 UI

## 기술 스택

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **Database**: MongoDB (MongoDB Atlas)
- **Deployment**: Vercel

## 로컬 개발 환경 설정

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
프로젝트 루트에 `.env` 파일을 생성하고 다음 내용을 추가하세요:

```env
MONGO_URI=mongodb+srv://your_username:your_password@your_cluster.mongodb.net/price-tracker?retryWrites=true&w=majority
PORT=3000
NODE_ENV=development
```

### 3. MongoDB Atlas 설정
1. [MongoDB Atlas](https://www.mongodb.com/atlas)에 가입
2. 새 클러스터 생성
3. Database Access에서 사용자 생성
4. Network Access에서 IP 주소 추가 (0.0.0.0/0으로 모든 IP 허용)
5. Connect 버튼을 클릭하여 연결 문자열 복사
6. `.env` 파일의 `MONGO_URI`에 연결 문자열 붙여넣기

### 4. 서버 실행
```bash
npm start
```

브라우저에서 `http://localhost:3000`으로 접속하세요.

## Vercel 배포

### 1. Vercel CLI 설치
```bash
npm i -g vercel
```

### 2. Vercel 로그인
```bash
vercel login
```

### 3. 환경 변수 설정
Vercel 대시보드에서 다음 환경 변수를 설정하세요:
- `MONGO_URI`: MongoDB Atlas 연결 문자열

### 4. 배포
```bash
vercel --prod
```

## API 엔드포인트

- `GET /api/prices` - 모든 가격 데이터 조회
- `POST /api/prices` - 새로운 가격 데이터 추가
- `DELETE /api/prices/:id` - 특정 가격 데이터 삭제

## 프로젝트 구조

```
price-tracker/
├── public/           # 프론트엔드 파일
│   ├── index.html    # 메인 HTML
│   ├── style.css     # 스타일시트
│   └── script.js     # 클라이언트 JavaScript
├── api/              # API 라우트
│   └── index.js      # API 엔드포인트
├── index.js          # 서버 메인 파일
├── package.json      # 프로젝트 설정
├── vercel.json       # Vercel 배포 설정
└── README.md         # 프로젝트 문서
```

## 라이선스

ISC License 