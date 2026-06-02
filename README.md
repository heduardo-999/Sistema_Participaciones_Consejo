# Sistema de Gestión de Participaciones para Sesiones del Consejo

## Descripción

Proyecto desarrollado como parte de la **Liberación de Servicio Social** en la **Subdirección Académica de la Escuela Superior de Ingeniería Mecánica y Eléctrica (ESIME) Unidad Culhuacán**, perteneciente al Instituto Politécnico Nacional (IPN).

El objetivo del sistema es administrar de forma eficiente las sesiones del consejo mediante el control de asistencia, ocupación de lugares, solicitudes de participación, turnos de intervención y monitoreo del tiempo de palabra de los participantes.

---

## Tecnologías

### Backend

* Laravel 12
* PHP 8.4+
* MySQL

### Frontend

* Astro
* HTML5
* CSS3
* JavaScript

### Entorno de Desarrollo

* Laragon
* Composer
* Git
* Visual Studio Code

### Hardware

* ESP32
* RFID
* Botones físicos
* LED RGB
* LED Amarillo

---

## Funcionalidades Principales

* Gestión de sesiones del consejo.
* Registro de miembros e invitados.
* Control de asistencia mediante RFID.
* Administración de lugares físicos.
* Solicitud de participación mediante botón físico.
* Cola de intervenciones en tiempo real.
* Control del tiempo de palabra.
* Indicadores visuales mediante LEDs.
* Registro histórico de participaciones.

---

## Arquitectura General

```text
Frontend (Astro)
        │
        ▼
Backend (Laravel)
        │
        ▼
      MySQL
        │
        ▼
      ESP32
        │
 ┌──────┼──────┐
 ▼      ▼      ▼
RFID  Botón  LEDs
```

---

## Estructura del Proyecto

```text
council-participation-system/
│
├── backend/
│   └── Laravel
│
├── frontend/
│   └── Astro
│
├── hardware/
│   └── ESP32
│
├── database/
│
├── docs/
│
└── README.md
```

---

## Estado del Proyecto

🚧 En fase de análisis, diseño e implementación inicial.

Actualmente se trabaja en:

* Levantamiento de requerimientos.
* Diseño de base de datos.
* Desarrollo del backend en Laravel.
* Desarrollo del frontend en Astro.
* Planeación de integración con ESP32 y RFID.

---

## Autor

**Eduardo Armando Hernandez Molina**
Ingeniería en Computación
ESIME Culhuacán – Instituto Politécnico Nacional

Proyecto realizado para la **Subdirección Académica de ESIME Culhuacán** como parte de la **Liberación de Servicio Social**.

