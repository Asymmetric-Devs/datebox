# datebox

<p align="center">
  <img src="apps/mobile/assets/images/logo/datebox-sinfondo.png" alt="Datebox" width="220" />
</p>

Datebox es una app para organizar planes, compartir recuerdos, actividades y momentos importantes en un solo lugar. Úsalo con tu pareja, amigos o familia 

## Proyecto

- Planificación
  - Especificación de Requisitos de Software: https://docs.google.com/document/d/1R3vB02NTxqxi9H_KYEBNzvEl6xEbmV-Q1nAyWVGubfI
  - Planificación: https://docs.google.com/document/d/1NqHx6Go_-peDly_qNYltLgTfeM6FCRMo5ZNa35w0yvI
  - Diagramas técnicos (DER): https://drive.google.com/file/d/1_6j1oftihcGSm7DQh2r-obAzsL51-S-g
- Gestión del proyecto
  - Backlog: https://github.com/orgs/elepad-org/projects/2/views/3
  - Roadmap: https://github.com/orgs/elepad-org/projects/2/views/2
  - Tablero: https://github.com/orgs/elepad-org/projects/2/views/1
- Diseño
  - Canva (User Story Map): https://www.canva.com/design/DAGtndSDPec/fhyqoHBOG9PvgYRHk9xqmA/edit
  - Figma (mockups): https://www.figma.com/design/rQOZ89Fed9UmfvBsExJyAo/Elepad-Mobile-App

## Estructura del repositorio

```yaml
├── apps/             # Aplicaciones
│   ├── api/            # Backend API
│   └── mobile/         # App móvil
├── packages/         # Paquetes compartidos
│   ├── api-client/     # Cliente API generado
│   └── assets/         # Recursos de marca
└── supabase/         # Configuración y migraciones
```

## Desarrollo

1. Instalar dependencias

   ```bash
   npm install
   ```

2. Configurar variables de entorno usando los ejemplos

   ```bash
   # apps/api/.env.example
   # apps/mobile/.env.example
   # supabase/.env.example
   ```

3. Levantar el entorno

   ```bash
   npm run dev
   ```

## Contacto

- Email: proyectoelepad@gmail.com
- La app mobile a EAS Hosting ([https://ele.expo.app/](https://ele.expo.app/)).

Desde GitHub Actions se actualizan todas las variables de entorno de cada nube. Es necesario definir en este repositorio los siguientes secrets:

```bash
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_API_TOKEN
API_URL
SUPABASE_PUBLISHABLE_KEY
GOOGLE_CLIENT_ID
EAS_TOKEN
```

Aclaración: solo algunos valores son sensibles, pero por simplicidad se los maneja a todos como secrets.
