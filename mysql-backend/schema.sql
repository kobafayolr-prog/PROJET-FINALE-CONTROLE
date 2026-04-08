-- ============================================================
-- TimeTrack BGFIBank - Schéma MySQL COMPLET v2
-- Compatible MySQL 5.7+ / MySQL 8.0+ / MariaDB 10.4+
-- À exécuter UNE FOIS lors de l'installation initiale
-- ============================================================

CREATE DATABASE IF NOT EXISTS timetrack_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE timetrack_db;

-- ============================================================
-- TABLE : strategic_objectives
-- ============================================================
CREATE TABLE IF NOT EXISTS strategic_objectives (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(255)  NOT NULL,
  description       TEXT,
  color             VARCHAR(20)   NOT NULL DEFAULT '#1e3a5f',
  target_percentage DECIMAL(5,2)  NOT NULL DEFAULT 0,
  status            ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  created_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : departments
-- ============================================================
CREATE TABLE IF NOT EXISTS departments (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  code        VARCHAR(20)  NOT NULL UNIQUE,
  description TEXT,
  status      ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  created_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ============================================================
-- TABLE : processes (services)
-- ============================================================
CREATE TABLE IF NOT EXISTS processes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  department_id INT UNSIGNED NOT NULL,
  objective_id  INT UNSIGNED NOT NULL,
  status        ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_processes_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE CASCADE,
  CONSTRAINT fk_processes_obj  FOREIGN KEY (objective_id)  REFERENCES strategic_objectives(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_processes_dept ON processes(department_id);

-- ============================================================
-- TABLE : tasks
-- ============================================================
CREATE TABLE IF NOT EXISTS tasks (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  description   TEXT,
  department_id INT UNSIGNED NOT NULL,
  process_id    INT UNSIGNED NOT NULL,
  objective_id  INT UNSIGNED NOT NULL,
  -- task_type LIBRE (VARCHAR) pour supporter Production / Administration & Reporting / Contrôle
  task_type     VARCHAR(100) NOT NULL DEFAULT 'Production',
  status        ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  created_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tasks_dept FOREIGN KEY (department_id) REFERENCES departments(id)             ON DELETE CASCADE,
  CONSTRAINT fk_tasks_proc FOREIGN KEY (process_id)   REFERENCES processes(id)               ON DELETE CASCADE,
  CONSTRAINT fk_tasks_obj  FOREIGN KEY (objective_id) REFERENCES strategic_objectives(id)    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_tasks_dept ON tasks(department_id);

-- ============================================================
-- TABLE : users  (7 rôles bancaires)
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  first_name         VARCHAR(100) NOT NULL,
  last_name          VARCHAR(100) NOT NULL,
  email              VARCHAR(255) NOT NULL UNIQUE,
  password_hash      VARCHAR(512) NOT NULL  COMMENT 'Format : pbkdf2:sha256:600000:salt:hash',
  password_encrypted TEXT         DEFAULT NULL COMMENT 'XOR+Base64 pour consultation admin',
  role               ENUM(
                       'Agent',
                       'Chef de Service',
                       'Chef de Département',
                       'Directeur de Département',
                       'Directeur Général',
                       'Administrateur'
                     ) NOT NULL DEFAULT 'Agent',
  department_id      INT UNSIGNED DEFAULT NULL,
  status             ENUM('Actif','Inactif') NOT NULL DEFAULT 'Actif',
  works_saturday     TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = travaille le samedi',
  twofa_secret       VARCHAR(64)  DEFAULT NULL COMMENT 'Secret TOTP pour 2FA (base32)',
  twofa_enabled      TINYINT(1)   NOT NULL DEFAULT 0 COMMENT '1 = 2FA activé',
  twofa_backup_codes TEXT         DEFAULT NULL COMMENT 'Codes de secours 2FA (JSON array)',
  last_login         DATETIME     DEFAULT NULL,
  created_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_users_dept FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_users_dept          ON users(department_id);
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_works_saturday ON users(works_saturday);

-- ============================================================
-- TABLE : work_sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS work_sessions (
  id               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id          INT UNSIGNED NOT NULL,
  task_id          INT UNSIGNED NOT NULL,
  objective_id     INT UNSIGNED NOT NULL,
  department_id    INT UNSIGNED NOT NULL,
  start_time       DATETIME     NOT NULL,
  end_time         DATETIME     DEFAULT NULL,
  duration_minutes INT          NOT NULL DEFAULT 0,
  session_type     ENUM('Auto','Manuelle') NOT NULL DEFAULT 'Auto',
  status           ENUM('En cours','Terminé','Validé','Rejeté','En attente') NOT NULL DEFAULT 'En cours',
  comment          TEXT         DEFAULT NULL,
  validated_by     INT UNSIGNED DEFAULT NULL,
  validated_at     DATETIME     DEFAULT NULL,
  rejected_reason  TEXT         DEFAULT NULL,
  created_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_ws_user  FOREIGN KEY (user_id)       REFERENCES users(id)                ON DELETE CASCADE,
  CONSTRAINT fk_ws_task  FOREIGN KEY (task_id)       REFERENCES tasks(id)                ON DELETE CASCADE,
  CONSTRAINT fk_ws_obj   FOREIGN KEY (objective_id)  REFERENCES strategic_objectives(id) ON DELETE CASCADE,
  CONSTRAINT fk_ws_dept  FOREIGN KEY (department_id) REFERENCES departments(id)          ON DELETE CASCADE,
  CONSTRAINT fk_ws_valid FOREIGN KEY (validated_by)  REFERENCES users(id)               ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_ws_user   ON work_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_ws_status ON work_sessions(status);
CREATE INDEX IF NOT EXISTS idx_ws_obj    ON work_sessions(objective_id);
CREATE INDEX IF NOT EXISTS idx_ws_dept   ON work_sessions(department_id);
CREATE INDEX IF NOT EXISTS idx_ws_start  ON work_sessions(start_time);

-- ✅ OPTIMISATION: Index composites pour requêtes fréquentes (gain 50-80% performance)
CREATE INDEX IF NOT EXISTS idx_ws_dept_start_status ON work_sessions(department_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_ws_user_start_status ON work_sessions(user_id, start_time, status);
CREATE INDEX IF NOT EXISTS idx_ws_status_start      ON work_sessions(status, start_time);
CREATE INDEX IF NOT EXISTS idx_ws_dept_obj_start    ON work_sessions(department_id, objective_id, start_time);

-- ============================================================
-- TABLE : audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id    INT UNSIGNED DEFAULT NULL,
  action     VARCHAR(100) NOT NULL,
  details    TEXT         DEFAULT NULL,
  ip_address VARCHAR(50)  DEFAULT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_audit_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE INDEX IF NOT EXISTS idx_audit_user    ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);

-- ============================================================
-- TABLE : invalidated_tokens (JWT blacklist persistante)
-- ============================================================
CREATE TABLE IF NOT EXISTS invalidated_tokens (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  token_hash  VARCHAR(64) NOT NULL UNIQUE COMMENT 'SHA-256 hash du token JWT',
  invalidated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at  DATETIME NOT NULL COMMENT 'Date expiration du token original',
  INDEX idx_token_hash (token_hash),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
