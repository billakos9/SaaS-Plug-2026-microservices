# NTUA ECE SAAS 2026 PROJECT

## TEAM 09

## 📁 Root structure
```
saasplug/
│
├── apps/ # entry points
│ ├── api-gateway/
│ ├── web-app/ # frontend
│
├── services/
│ ├── auth-service/
│ ├── user-service/
│ ├── charger-service/
│ ├── reservation-service/
│ ├── provider-service/
│ ├── analytics-service/
│ ├── admin-service/
│ ├── plug-service/ 
│ ├── adapters/ 
│   ├── blueplug/
│   ├── redplug/
│   ├── greenplug/
│
├── shared/ # shared logic
│ ├── types/ # DTOs, interfaces
│ ├── utils/
│ ├── config/
│ ├── logger/
│ ├── errors/
│
├── scripts/ # dev scripts
│
├── .eslintrc.js
├── .prettierrc
├── package.json
├── docker-compose.yml
└── README.md
```