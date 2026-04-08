PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE d1_migrations(
		id         INTEGER PRIMARY KEY AUTOINCREMENT,
		name       TEXT UNIQUE,
		applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);
INSERT INTO "d1_migrations" VALUES(1,'0001_initial_schema.sql','2026-04-01 16:12:38');
INSERT INTO "d1_migrations" VALUES(2,'0002_add_security.sql','2026-04-01 16:12:39');
INSERT INTO "d1_migrations" VALUES(3,'0003_bcrypt_remove_password_encrypted.sql','2026-04-01 16:12:39');
INSERT INTO "d1_migrations" VALUES(4,'0004_new_roles.sql','2026-04-02 16:20:11');
INSERT INTO "d1_migrations" VALUES(5,'0005_replace_objectives_with_333.sql','2026-04-07 10:53:35');
INSERT INTO "d1_migrations" VALUES(6,'0006_works_saturday.sql','2026-04-07 12:32:31');
CREATE TABLE strategic_objectives (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT DEFAULT '#1e3a5f',
  target_percentage REAL DEFAULT 0,
  status TEXT DEFAULT 'Actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "strategic_objectives" VALUES(1,'Développement Commercial','Croissance et acquisition clients','#22c55e',30,'Inactif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "strategic_objectives" VALUES(2,'Expérience Client','Amélioration de la satisfaction client','#f59e0b',25,'Inactif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "strategic_objectives" VALUES(3,'Maîtrise des Frais Généraux','Optimisation et contrôle des coûts','#0521ad',20,'Inactif','2026-04-01 16:12:42','2026-04-02 15:37:09');
INSERT INTO "strategic_objectives" VALUES(4,'Maîtrise des Pertes Opérationnelles','Réduction des risques et pertes','#ef4444',15,'Inactif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "strategic_objectives" VALUES(5,'PNB','Produit Net Bancaire','#1e3a5f',10,'Inactif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "strategic_objectives" VALUES(10,'Production','Activités directement productives : traitement des opérations, service client, production bancaire.','#1e3a5f',70,'Actif','2026-04-07 10:53:35','2026-04-07 10:53:35');
INSERT INTO "strategic_objectives" VALUES(11,'Administration & Reporting','Activités administratives, reporting, réunions, formation et tâches de support.','#f59e0b',20,'Actif','2026-04-07 10:53:35','2026-04-07 10:53:35');
INSERT INTO "strategic_objectives" VALUES(12,'Contrôle','Activités de contrôle, audit, conformité, supervision et vérification.','#10b981',10,'Actif','2026-04-07 10:53:35','2026-04-07 10:53:35');
CREATE TABLE departments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'Actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "departments" VALUES(1,'Direction Commerciale','DC','Direction en charge du développement commercial','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(2,'Direction Conformité','DCONF','Direction en charge de la conformité réglementaire','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(3,'Direction Financière','DF','Direction en charge des finances','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(4,'Direction Générale','DG','Direction Générale de la banque','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(5,'Direction Informatique','DI','Direction des systèmes d''information','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(6,'Direction des Opérations et de la Trésorerie','DOT','Direction des opérations bancaires','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(7,'Direction des Ressources Humaines','DRH','Direction des ressources humaines','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(8,'Direction des Risques','DR','Direction en charge de la gestion des risques','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "departments" VALUES(9,'CONTROLE PERMANENT ','CP','','Actif','2026-04-02 16:38:47','2026-04-02 16:38:47');
CREATE TABLE processes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  department_id INTEGER NOT NULL,
  objective_id INTEGER NOT NULL,
  status TEXT DEFAULT 'Actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (objective_id) REFERENCES strategic_objectives(id)
);
INSERT INTO "processes" VALUES(1,'Analyse financière','Analyse et interprétation financière',3,5,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(2,'Comptabilité','Tenue de la comptabilité',3,3,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(3,'Conformité réglementaire','Suivi des obligations réglementaires',2,4,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(4,'Contrôle interne','Contrôle des opérations internes',6,4,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(5,'Développement système','Maintenance et développement SI',5,3,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(6,'Formation','Formation du personnel',7,3,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(7,'Gestion des crédits','Gestion du portefeuille crédit',1,5,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(8,'Gestion des risques','Identification et gestion des risques',8,4,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(9,'Lutte anti-blanchiment','Conformité anti-blanchiment',2,4,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(10,'Prospection commerciale','Prospection et acquisition clients',1,1,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(11,'Recrutement','Recrutement du personnel',7,3,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(12,'Service clientèle','Accueil et service clients',1,2,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(13,'Support informatique','Support technique aux utilisateurs',5,3,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "processes" VALUES(14,'Traitement des opérations','Traitement des opérations bancaires',6,5,'Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
CREATE TABLE tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  department_id INTEGER NOT NULL,
  process_id INTEGER NOT NULL,
  objective_id INTEGER NOT NULL,
  task_type TEXT DEFAULT 'Productive',
  status TEXT DEFAULT 'Actif',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (process_id) REFERENCES processes(id),
  FOREIGN KEY (objective_id) REFERENCES strategic_objectives(id)
);
INSERT INTO "tasks" VALUES(1,'Accueil clientèle','Réception et orientation des clients',1,12,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(2,'Démarchage téléphonique','Appels de prospection de nouveaux clients',1,10,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(3,'Montage dossier crédit','Préparation et analyse des dossiers de crédit',1,7,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(4,'Rendez-vous clients','Visites et entretiens commerciaux',1,10,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(5,'Suivi des engagements','Monitoring du portefeuille crédit',1,7,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(6,'Traitement des réclamations','Gestion et résolution des plaintes',1,12,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(7,'Contrôle KYC','Vérification de la conformité des clients',2,9,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(8,'Déclarations COBAC','Préparation des déclarations réglementaires',2,3,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(9,'Veille réglementaire','Suivi des évolutions réglementaires',2,3,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(10,'Analyse du bilan','Étude et interprétation du bilan',3,1,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(11,'Clôture mensuelle','Arrêtés et clôtures comptables mensuels',3,2,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(12,'Déclarations fiscales','Préparation des déclarations fiscales',3,2,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(13,'Gestion budgétaire','Suivi et contrôle budgétaire',3,2,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(14,'Développement système','Développement et maintenance des applications',5,5,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(15,'Support technique','Assistance technique aux utilisateurs',5,13,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(16,'Traitement des virements','Traitement des ordres de virement',6,14,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(17,'Contrôle des opérations','Vérification des opérations traitées',6,4,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(18,'Formation du personnel','Organisation et animation des formations',7,6,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(19,'Recrutement','Processus de recrutement',7,11,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(20,'Analyse des risques crédit','Évaluation des risques de crédit',8,8,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(21,'Reporting risques','Préparation des rapports de risques',8,8,10,'Production','Actif','2026-04-01 16:12:42','2026-04-01 16:12:42');
INSERT INTO "tasks" VALUES(50,'Rédaction de rapports','Rapports périodiques',1,10,11,'Administration & Reporting','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(51,'Réunion d équipe','Réunions internes',1,10,11,'Administration & Reporting','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(52,'Mise à jour tableaux de bord','Tableaux de bord mensuels',2,3,11,'Administration & Reporting','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(53,'Compte-rendu de réunion','CR des réunions de direction',3,1,11,'Administration & Reporting','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(54,'Reporting mensuel DG','Rapport mensuel direction',4,1,11,'Administration & Reporting','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(55,'Contrôle des dossiers','Vérification dossiers clients',1,7,12,'Contrôle','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(56,'Audit interne','Audit des processus',2,4,12,'Contrôle','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(57,'Vérification conformité','Contrôle conformité réglementaire',2,3,12,'Contrôle','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(58,'Contrôle qualité','Qualité des livrables',3,4,12,'Contrôle','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "tasks" VALUES(59,'Supervision opérations','Supervision quotidienne',1,10,12,'Contrôle','Actif','2026-04-07 15:21:07','2026-04-07 15:21:07');
CREATE TABLE users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT DEFAULT 'Agent',
  department_id INTEGER,
  status TEXT DEFAULT 'Actif',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP, works_saturday INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (department_id) REFERENCES departments(id)
);
INSERT INTO "users" VALUES(1,'Fayolle','KOBA','admin@bgfibank.com','pbkdf2:sha256:600000:bd06db94ba8e633acdd0aff4a655d6e7:e479e6108613248063be14814843a14454c6125308f53e8e53eb40f0810d1421','Administrateur',NULL,'Actif','2026-04-08 09:44:24','2026-04-01 16:12:42','2026-04-08 09:45:39',0);
INSERT INTO "users" VALUES(2,'Marc','NZOGHE','chef.commercial@bgfibank.com','pbkdf2:sha256:600000:538d85518d5e3f66ac27d527bc5dce66:abcd24e66c2787d6050242c502b6b9152c36c8c0b0c99b38709e83c51e55d2dc','Chef de Département',1,'Actif','2026-04-07 15:46:06','2026-04-01 16:12:42','2026-04-07 15:46:06',0);
INSERT INTO "users" VALUES(3,'Sandra','MBOUMBA','agent.commercial@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',1,'Actif','2026-04-01 16:40:20','2026-04-01 16:12:42','2026-04-01 16:29:36',0);
INSERT INTO "users" VALUES(4,'Eliel','KAPOU','eliel@bgfi.com','pbkdf2:sha256:600000:bfa64ea71336ccacb834c3cb42170ec9:fd0abc0c67449623ee5d38a45ebddce9c00c92954cde38304297450f15343c7b','Agent',8,'Actif','2026-04-07 15:53:33','2026-04-01 16:12:42','2026-04-07 15:46:06',0);
INSERT INTO "users" VALUES(5,'Ingara','MAIDOU','maidou@bgfi.com','pbkdf2:sha256:600000:b1046fac43eb7c18665a5df23c5f136d:15d4fe103b020b896ef89bdb649189bb6deec5f2afe1af281ead8afc3c8cf081','Chef de Département',8,'Actif','2026-04-07 16:07:58','2026-04-01 16:12:42','2026-04-07 15:46:06',0);
INSERT INTO "users" VALUES(10,'Achille','OBAME','achille.obame@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',1,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(11,'Christelle','NKOGHE','christelle.nkoghe@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',1,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(12,'Patrick','ELLA NDONG','patrick.ella@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',2,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(13,'Laure','BIVIGOU','laure.bivigou@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',2,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(14,'Bruno','MOUSSAVOU','bruno.moussavou@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',3,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(15,'Gaelle','ONDO','gaelle.ondo@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Agent',3,'Actif',NULL,'2026-04-07 15:15:30','2026-04-07 15:15:30',0);
INSERT INTO "users" VALUES(100,'Hervé Ghislain ','KOGBOMA','dg@bgfibank.com','pbkdf2:sha256:600000:05fbc586d7dce6bf2d2a6506535d56ea:c6547698a5754a84cd5432ea99fb9ee04fdbf4dd3d05693592bfdd26c5cfff1e','Directeur Général',NULL,'Actif','2026-04-07 17:32:49','2026-04-02 16:20:11','2026-04-07 15:46:07',0);
INSERT INTO "users" VALUES(101,'Elie','NGUEMA OVONO','elie@bgfibank.com','pbkdf2:sha256:600000:a9fe6d475a36e70990e91d68f7cb1229:17c8cf9edd64d87d7a969591e312ef52d3a4de9a9742bb93356cd4ff6cdc41a1','Directeur de Département',9,'Actif','2026-04-07 17:36:38','2026-04-02 16:40:30','2026-04-07 17:36:38',0);
INSERT INTO "users" VALUES(102,'Jean','TAHITI','tahiti@bgfibank.com','150018c79911742fcbcd462e2ba6018a0c70854d0623873c84ae27afe8592b50','Chef de Service',9,'Actif','2026-04-03 07:36:08','2026-04-02 16:42:04','2026-04-02 16:42:04',0);
INSERT INTO "users" VALUES(103,'Marie','BAGAZA','bagaza@bgfibank.com','pbkdf2:sha256:600000:001603eb73473cf6cdd01b10ee6c03cd:2068bac53d070f8a09d8f1b59d4c6aa7de1a69dfc714204aa9ec55878510d53f','Chef de Département',9,'Actif','2026-04-07 17:37:50','2026-04-02 16:43:50','2026-04-07 17:37:50',0);
CREATE TABLE work_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  objective_id INTEGER NOT NULL,
  department_id INTEGER NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration_minutes INTEGER DEFAULT 0,
  session_type TEXT DEFAULT 'Auto',
  status TEXT DEFAULT 'En cours',
  comment TEXT,
  validated_by INTEGER,
  validated_at DATETIME,
  rejected_reason TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (task_id) REFERENCES tasks(id),
  FOREIGN KEY (objective_id) REFERENCES strategic_objectives(id),
  FOREIGN KEY (department_id) REFERENCES departments(id),
  FOREIGN KEY (validated_by) REFERENCES users(id)
);
INSERT INTO "work_sessions" VALUES(1,4,21,10,8,'2026-04-01 16:33:48','2026-04-01 16:34:07',0,'Auto','Validé',NULL,5,'2026-04-01 16:34:33',NULL,'2026-04-01 16:33:48','2026-04-01 16:34:33');
INSERT INTO "work_sessions" VALUES(2,4,20,10,8,'2026-04-01 16:35:20','2026-04-01 16:35:53',1,'Auto','Validé',NULL,5,'2026-04-01 16:36:23',NULL,'2026-04-01 16:35:20','2026-04-01 16:36:23');
INSERT INTO "work_sessions" VALUES(5,4,21,10,8,'2026-04-01 16:41:56','2026-04-01 16:42:17',0,'Auto','Validé',NULL,5,'2026-04-01 16:43:07',NULL,'2026-04-01 16:41:56','2026-04-01 16:43:07');
INSERT INTO "work_sessions" VALUES(6,4,21,10,8,'2026-04-01 16:43:25','2026-04-01 16:44:00',1,'Auto','Validé',NULL,5,'2026-04-07 15:43:02',NULL,'2026-04-01 16:43:25','2026-04-07 15:43:02');
INSERT INTO "work_sessions" VALUES(149,4,1,10,1,'2026-03-03 08:00:00','2026-03-03 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(150,4,50,11,1,'2026-03-03 14:00:00','2026-03-03 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(151,4,55,12,1,'2026-03-03 15:30:00','2026-03-03 16:30:00',60,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(152,4,2,10,1,'2026-03-04 08:00:00','2026-03-04 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(153,4,50,11,1,'2026-03-04 14:00:00','2026-03-04 15:00:00',60,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(154,4,55,12,1,'2026-03-04 15:00:00','2026-03-04 16:00:00',60,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(155,4,3,10,1,'2026-03-05 08:00:00','2026-03-05 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(156,4,51,11,1,'2026-03-05 14:00:00','2026-03-05 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(157,4,4,10,1,'2026-03-06 08:00:00','2026-03-06 14:00:00',360,'Auto','Validé',NULL,2,'2026-03-07 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(158,4,50,11,1,'2026-03-06 14:30:00','2026-03-06 16:30:00',120,'Auto','Validé',NULL,2,'2026-03-07 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(159,4,5,10,1,'2026-03-10 08:00:00','2026-03-10 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(160,4,55,12,1,'2026-03-10 14:00:00','2026-03-10 15:00:00',60,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(161,4,1,10,1,'2026-03-11 08:00:00','2026-03-11 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-12 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(162,4,51,11,1,'2026-03-11 14:00:00','2026-03-11 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-12 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(163,4,2,10,1,'2026-03-12 08:00:00','2026-03-12 14:00:00',360,'Auto','Validé',NULL,2,'2026-03-13 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(164,4,55,12,1,'2026-03-12 14:30:00','2026-03-12 16:00:00',90,'Auto','Validé',NULL,2,'2026-03-13 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(165,4,3,10,1,'2026-03-13 08:00:00','2026-03-13 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-14 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(166,4,50,11,1,'2026-03-13 14:00:00','2026-03-13 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-14 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(167,4,4,10,1,'2026-03-17 08:00:00','2026-03-17 14:00:00',360,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(168,4,55,12,1,'2026-03-17 14:30:00','2026-03-17 16:00:00',90,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(169,4,5,10,1,'2026-03-18 08:00:00','2026-03-18 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-19 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(170,4,51,11,1,'2026-03-18 14:00:00','2026-03-18 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-19 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(171,3,1,10,1,'2026-03-03 08:00:00','2026-03-03 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(172,3,51,11,1,'2026-03-03 14:00:00','2026-03-03 15:00:00',60,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(173,3,55,12,1,'2026-03-03 15:00:00','2026-03-03 16:30:00',90,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(174,3,2,10,1,'2026-03-04 08:00:00','2026-03-04 12:30:00',270,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(175,3,50,11,1,'2026-03-04 13:30:00','2026-03-04 15:00:00',90,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(176,3,3,10,1,'2026-03-05 08:00:00','2026-03-05 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(177,3,55,12,1,'2026-03-05 14:00:00','2026-03-05 15:00:00',60,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(178,3,4,10,1,'2026-03-10 08:00:00','2026-03-10 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(179,3,51,11,1,'2026-03-10 14:00:00','2026-03-10 16:00:00',120,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(180,3,5,10,1,'2026-03-11 08:00:00','2026-03-11 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-12 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(181,3,55,12,1,'2026-03-11 14:00:00','2026-03-11 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-12 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(182,3,1,10,1,'2026-03-17 08:00:00','2026-03-17 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(183,3,50,11,1,'2026-03-17 14:00:00','2026-03-17 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(184,10,1,10,1,'2026-03-03 08:00:00','2026-03-03 14:00:00',360,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(185,10,50,11,1,'2026-03-03 14:30:00','2026-03-03 16:00:00',90,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(186,10,55,12,1,'2026-03-03 16:00:00','2026-03-03 16:30:00',30,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(187,10,2,10,1,'2026-03-04 08:00:00','2026-03-04 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(188,10,50,11,1,'2026-03-04 14:00:00','2026-03-04 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(189,10,3,10,1,'2026-03-05 08:00:00','2026-03-05 14:00:00',360,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(190,10,55,12,1,'2026-03-05 14:30:00','2026-03-05 16:00:00',90,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(191,10,1,10,1,'2026-03-10 08:00:00','2026-03-10 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(192,10,51,11,1,'2026-03-10 14:00:00','2026-03-10 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(193,10,55,12,1,'2026-03-10 15:30:00','2026-03-10 16:30:00',60,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(194,10,2,10,1,'2026-03-17 08:00:00','2026-03-17 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(195,10,55,12,1,'2026-03-17 14:00:00','2026-03-17 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(196,11,2,10,1,'2026-03-03 08:00:00','2026-03-03 12:30:00',270,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(197,11,50,11,1,'2026-03-03 13:30:00','2026-03-03 15:30:00',120,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(198,11,55,12,1,'2026-03-03 15:30:00','2026-03-03 16:30:00',60,'Auto','Validé',NULL,2,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(199,11,3,10,1,'2026-03-04 08:00:00','2026-03-04 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(200,11,51,11,1,'2026-03-04 14:00:00','2026-03-04 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(201,11,4,10,1,'2026-03-05 08:00:00','2026-03-05 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(202,11,55,12,1,'2026-03-05 14:00:00','2026-03-05 15:00:00',60,'Auto','Validé',NULL,2,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(203,11,5,10,1,'2026-03-10 08:00:00','2026-03-10 13:30:00',330,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(204,11,50,11,1,'2026-03-10 14:00:00','2026-03-10 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(205,11,55,12,1,'2026-03-10 16:00:00','2026-03-10 16:30:00',30,'Auto','Validé',NULL,2,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(206,11,1,10,1,'2026-03-17 08:00:00','2026-03-17 13:00:00',300,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(207,11,50,11,1,'2026-03-17 14:00:00','2026-03-17 15:30:00',90,'Auto','Validé',NULL,2,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(208,12,7,10,2,'2026-03-03 08:00:00','2026-03-03 13:30:00',330,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(209,12,52,11,2,'2026-03-03 14:00:00','2026-03-03 15:30:00',90,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(210,12,56,12,2,'2026-03-03 15:30:00','2026-03-03 16:30:00',60,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(211,12,8,10,2,'2026-03-04 08:00:00','2026-03-04 13:00:00',300,'Auto','Validé',NULL,5,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(212,12,52,11,2,'2026-03-04 14:00:00','2026-03-04 15:30:00',90,'Auto','Validé',NULL,5,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(213,12,9,10,2,'2026-03-05 08:00:00','2026-03-05 14:00:00',360,'Auto','Validé',NULL,5,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(214,12,56,12,2,'2026-03-05 14:30:00','2026-03-05 16:00:00',90,'Auto','Validé',NULL,5,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(215,12,7,10,2,'2026-03-10 08:00:00','2026-03-10 13:00:00',300,'Auto','Validé',NULL,5,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(216,12,52,11,2,'2026-03-10 14:00:00','2026-03-10 16:00:00',120,'Auto','Validé',NULL,5,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(217,12,8,10,2,'2026-03-17 08:00:00','2026-03-17 13:30:00',330,'Auto','Validé',NULL,5,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(218,12,56,12,2,'2026-03-17 14:00:00','2026-03-17 15:00:00',60,'Auto','Validé',NULL,5,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(219,13,9,10,2,'2026-03-03 08:00:00','2026-03-03 12:30:00',270,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(220,13,52,11,2,'2026-03-03 13:30:00','2026-03-03 15:30:00',120,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(221,13,57,12,2,'2026-03-03 15:30:00','2026-03-03 16:30:00',60,'Auto','Validé',NULL,5,'2026-03-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(222,13,7,10,2,'2026-03-04 08:00:00','2026-03-04 13:00:00',300,'Auto','Validé',NULL,5,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(223,13,52,11,2,'2026-03-04 14:00:00','2026-03-04 15:30:00',90,'Auto','Validé',NULL,5,'2026-03-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(224,13,8,10,2,'2026-03-05 08:00:00','2026-03-05 13:30:00',330,'Auto','Validé',NULL,5,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(225,13,57,12,2,'2026-03-05 14:00:00','2026-03-05 15:30:00',90,'Auto','Validé',NULL,5,'2026-03-06 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(226,13,9,10,2,'2026-03-10 08:00:00','2026-03-10 13:30:00',330,'Auto','Validé',NULL,5,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(227,13,52,11,2,'2026-03-10 14:00:00','2026-03-10 16:00:00',120,'Auto','Validé',NULL,5,'2026-03-11 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(228,13,7,10,2,'2026-03-17 08:00:00','2026-03-17 13:00:00',300,'Auto','Validé',NULL,5,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(229,13,57,12,2,'2026-03-17 14:00:00','2026-03-17 15:30:00',90,'Auto','Validé',NULL,5,'2026-03-18 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(230,4,1,10,1,'2026-04-01 08:00:00','2026-04-01 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(231,4,50,11,1,'2026-04-01 14:00:00','2026-04-01 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(232,4,55,12,1,'2026-04-01 15:30:00','2026-04-01 16:30:00',60,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(233,4,2,10,1,'2026-04-02 08:00:00','2026-04-02 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(234,4,51,11,1,'2026-04-02 14:00:00','2026-04-02 15:00:00',60,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(235,4,55,12,1,'2026-04-02 15:00:00','2026-04-02 16:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(236,4,3,10,1,'2026-04-03 08:00:00','2026-04-03 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(237,4,50,11,1,'2026-04-03 14:30:00','2026-04-03 16:00:00',90,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(238,4,4,10,1,'2026-04-04 08:00:00','2026-04-04 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(239,4,55,12,1,'2026-04-04 14:00:00','2026-04-04 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(240,4,1,10,1,'2026-04-07 08:00:00','2026-04-07 15:40:23',460,'Auto','Terminé',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:40:23');
INSERT INTO "work_sessions" VALUES(241,4,50,11,1,'2026-04-07 14:30:00','2026-04-07 16:00:00',90,'Auto','En attente',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(242,3,1,10,1,'2026-04-01 08:00:00','2026-04-01 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(243,3,51,11,1,'2026-04-01 14:00:00','2026-04-01 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(244,3,55,12,1,'2026-04-01 15:30:00','2026-04-01 16:30:00',60,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(245,3,2,10,1,'2026-04-02 08:00:00','2026-04-02 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(246,3,50,11,1,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(247,3,3,10,1,'2026-04-03 08:00:00','2026-04-03 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(248,3,55,12,1,'2026-04-03 14:00:00','2026-04-03 15:00:00',60,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(249,3,4,10,1,'2026-04-04 08:00:00','2026-04-04 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(250,3,51,11,1,'2026-04-04 14:30:00','2026-04-04 16:00:00',90,'Auto','Validé',NULL,2,'2026-04-05 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(251,3,5,10,1,'2026-04-07 08:00:00','2026-04-07 13:30:00',330,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(252,10,2,10,1,'2026-04-01 08:00:00','2026-04-01 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(253,10,50,11,1,'2026-04-01 14:30:00','2026-04-01 16:00:00',90,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(254,10,3,10,1,'2026-04-02 08:00:00','2026-04-02 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(255,10,55,12,1,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(256,10,1,10,1,'2026-04-03 08:00:00','2026-04-03 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(257,10,51,11,1,'2026-04-03 14:00:00','2026-04-03 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(258,10,55,12,1,'2026-04-03 15:30:00','2026-04-03 16:30:00',60,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(259,10,2,10,1,'2026-04-07 08:00:00','2026-04-07 13:30:00',330,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(260,11,3,10,1,'2026-04-01 08:00:00','2026-04-01 12:30:00',270,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(261,11,50,11,1,'2026-04-01 13:30:00','2026-04-01 15:30:00',120,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(262,11,55,12,1,'2026-04-01 15:30:00','2026-04-01 16:30:00',60,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(263,11,4,10,1,'2026-04-02 08:00:00','2026-04-02 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(264,11,51,11,1,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(265,11,5,10,1,'2026-04-03 08:00:00','2026-04-03 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(266,11,55,12,1,'2026-04-03 14:00:00','2026-04-03 15:00:00',60,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(267,11,1,10,1,'2026-04-07 08:00:00','2026-04-07 12:00:00',240,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(268,12,7,10,2,'2026-04-01 08:00:00','2026-04-01 13:30:00',330,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(269,12,52,11,2,'2026-04-01 14:00:00','2026-04-01 15:30:00',90,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(270,12,56,12,2,'2026-04-01 15:30:00','2026-04-01 16:30:00',60,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(271,12,8,10,2,'2026-04-02 08:00:00','2026-04-02 13:00:00',300,'Auto','Validé',NULL,5,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(272,12,52,11,2,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,5,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(273,12,9,10,2,'2026-04-03 08:00:00','2026-04-03 14:00:00',360,'Auto','Validé',NULL,5,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(274,12,56,12,2,'2026-04-03 14:30:00','2026-04-03 16:00:00',90,'Auto','Validé',NULL,5,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(275,12,7,10,2,'2026-04-07 08:00:00','2026-04-07 13:30:00',330,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(276,13,7,10,2,'2026-04-01 08:00:00','2026-04-01 13:00:00',300,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(277,13,52,11,2,'2026-04-01 14:00:00','2026-04-01 15:30:00',90,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(278,13,57,12,2,'2026-04-01 15:30:00','2026-04-01 16:30:00',60,'Auto','Validé',NULL,5,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(279,13,8,10,2,'2026-04-02 08:00:00','2026-04-02 13:30:00',330,'Auto','Validé',NULL,5,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(280,13,52,11,2,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,5,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(281,13,9,10,2,'2026-04-03 08:00:00','2026-04-03 14:00:00',360,'Auto','Validé',NULL,5,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(282,13,57,12,2,'2026-04-03 14:30:00','2026-04-03 16:00:00',90,'Auto','Validé',NULL,5,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(283,13,8,10,2,'2026-04-07 08:00:00','2026-04-07 13:00:00',300,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(284,14,10,10,3,'2026-04-01 08:00:00','2026-04-01 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(285,14,54,11,3,'2026-04-01 14:30:00','2026-04-01 16:00:00',90,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(286,14,11,10,3,'2026-04-02 08:00:00','2026-04-02 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(287,14,58,12,3,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(288,14,12,10,3,'2026-04-03 08:00:00','2026-04-03 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(289,14,54,11,3,'2026-04-03 14:30:00','2026-04-03 16:30:00',120,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(290,14,10,10,3,'2026-04-07 08:00:00','2026-04-07 13:30:00',330,'Auto','En cours',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(291,15,11,10,3,'2026-04-01 08:00:00','2026-04-01 13:00:00',300,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(292,15,54,11,3,'2026-04-01 14:00:00','2026-04-01 16:00:00',120,'Auto','Validé',NULL,2,'2026-04-02 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(293,15,12,10,3,'2026-04-02 08:00:00','2026-04-02 13:30:00',330,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(294,15,58,12,3,'2026-04-02 14:00:00','2026-04-02 15:30:00',90,'Auto','Validé',NULL,2,'2026-04-03 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(295,15,13,10,3,'2026-04-03 08:00:00','2026-04-03 14:00:00',360,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(296,15,58,12,3,'2026-04-03 14:30:00','2026-04-03 16:00:00',90,'Auto','Validé',NULL,2,'2026-04-04 09:00:00',NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
INSERT INTO "work_sessions" VALUES(297,15,11,10,3,'2026-04-07 08:00:00','2026-04-07 12:30:00',270,'Auto','En attente',NULL,NULL,NULL,NULL,'2026-04-07 15:21:07','2026-04-07 15:21:07');
CREATE TABLE audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  action TEXT NOT NULL,
  details TEXT,
  ip_address TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);
INSERT INTO "audit_logs" VALUES(1,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:12:52');
INSERT INTO "audit_logs" VALUES(2,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-01 16:12:58');
INSERT INTO "audit_logs" VALUES(3,3,'LOGIN','Connexion réussie de Sandra MBOUMBA',NULL,'2026-04-01 16:12:58');
INSERT INTO "audit_logs" VALUES(4,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:13:04');
INSERT INTO "audit_logs" VALUES(5,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:13:09');
INSERT INTO "audit_logs" VALUES(6,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:20:01');
INSERT INTO "audit_logs" VALUES(7,1,'RESET_PASSWORD_REQUEST','Code reset généré pour Marc NZOGHE',NULL,'2026-04-01 16:20:20');
INSERT INTO "audit_logs" VALUES(8,1,'RESET_PASSWORD_REQUEST','Code reset généré pour Marc NZOGHE',NULL,'2026-04-01 16:20:44');
INSERT INTO "audit_logs" VALUES(9,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:29:35');
INSERT INTO "audit_logs" VALUES(10,3,'LOGIN','Connexion réussie de Sandra MBOUMBA',NULL,'2026-04-01 16:29:36');
INSERT INTO "audit_logs" VALUES(11,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-01 16:29:36');
INSERT INTO "audit_logs" VALUES(12,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:32:33');
INSERT INTO "audit_logs" VALUES(13,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:32:55');
INSERT INTO "audit_logs" VALUES(14,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-01 16:33:18');
INSERT INTO "audit_logs" VALUES(15,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-01 16:33:36');
INSERT INTO "audit_logs" VALUES(16,5,'VALIDATION','Session #1 validée',NULL,'2026-04-01 16:34:33');
INSERT INTO "audit_logs" VALUES(17,5,'VALIDATION','Session #2 validée',NULL,'2026-04-01 16:36:23');
INSERT INTO "audit_logs" VALUES(18,3,'LOGIN','Connexion réussie de Sandra MBOUMBA',NULL,'2026-04-01 16:38:06');
INSERT INTO "audit_logs" VALUES(19,3,'LOGIN','Connexion réussie de Sandra MBOUMBA',NULL,'2026-04-01 16:40:05');
INSERT INTO "audit_logs" VALUES(20,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-01 16:40:05');
INSERT INTO "audit_logs" VALUES(21,3,'LOGIN','Connexion réussie de Sandra MBOUMBA',NULL,'2026-04-01 16:40:20');
INSERT INTO "audit_logs" VALUES(22,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-01 16:40:32');
INSERT INTO "audit_logs" VALUES(23,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-01 16:42:46');
INSERT INTO "audit_logs" VALUES(24,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-01 16:42:54');
INSERT INTO "audit_logs" VALUES(25,5,'VALIDATION','Session #5 validée',NULL,'2026-04-01 16:43:07');
INSERT INTO "audit_logs" VALUES(26,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 16:46:32');
INSERT INTO "audit_logs" VALUES(27,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-01 17:17:16');
INSERT INTO "audit_logs" VALUES(28,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 06:47:04');
INSERT INTO "audit_logs" VALUES(29,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 06:54:58');
INSERT INTO "audit_logs" VALUES(30,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 06:56:31');
INSERT INTO "audit_logs" VALUES(31,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 07:08:20');
INSERT INTO "audit_logs" VALUES(32,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 09:03:13');
INSERT INTO "audit_logs" VALUES(33,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 10:25:02');
INSERT INTO "audit_logs" VALUES(34,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 10:25:12');
INSERT INTO "audit_logs" VALUES(35,1,'UPDATE_USER','Modification de l''utilisateur ID 1',NULL,'2026-04-02 10:27:19');
INSERT INTO "audit_logs" VALUES(36,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 10:27:31');
INSERT INTO "audit_logs" VALUES(37,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 10:41:51');
INSERT INTO "audit_logs" VALUES(38,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 13:55:47');
INSERT INTO "audit_logs" VALUES(39,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 14:12:40');
INSERT INTO "audit_logs" VALUES(40,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:37:37');
INSERT INTO "audit_logs" VALUES(41,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:37:44');
INSERT INTO "audit_logs" VALUES(42,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:37:48');
INSERT INTO "audit_logs" VALUES(43,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:39:54');
INSERT INTO "audit_logs" VALUES(44,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:40:01');
INSERT INTO "audit_logs" VALUES(45,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:40:22');
INSERT INTO "audit_logs" VALUES(46,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 14:42:38');
INSERT INTO "audit_logs" VALUES(47,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 14:57:03');
INSERT INTO "audit_logs" VALUES(48,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 16:32:21');
INSERT INTO "audit_logs" VALUES(49,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-02 16:32:26');
INSERT INTO "audit_logs" VALUES(50,100,'LOGIN','Connexion réussie de Jean-Marc DIRECTEUR',NULL,'2026-04-02 16:34:53');
INSERT INTO "audit_logs" VALUES(51,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 16:36:23');
INSERT INTO "audit_logs" VALUES(52,1,'CREATE_USER','Création de l''utilisateur Elie NGUEMA OVONO',NULL,'2026-04-02 16:40:30');
INSERT INTO "audit_logs" VALUES(53,1,'CREATE_USER','Création de l''utilisateur Jean TAHITI',NULL,'2026-04-02 16:42:04');
INSERT INTO "audit_logs" VALUES(54,1,'CREATE_USER','Création de l''utilisateur Marie BAGAZA',NULL,'2026-04-02 16:43:50');
INSERT INTO "audit_logs" VALUES(55,102,'LOGIN','Connexion réussie de Jean TAHITI',NULL,'2026-04-02 16:44:05');
INSERT INTO "audit_logs" VALUES(56,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-02 16:44:42');
INSERT INTO "audit_logs" VALUES(57,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-02 16:45:05');
INSERT INTO "audit_logs" VALUES(58,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 16:45:22');
INSERT INTO "audit_logs" VALUES(59,1,'UPDATE_USER','Modification de l''utilisateur ID 103',NULL,'2026-04-02 16:45:35');
INSERT INTO "audit_logs" VALUES(60,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-02 16:45:42');
INSERT INTO "audit_logs" VALUES(61,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-02 16:46:03');
INSERT INTO "audit_logs" VALUES(62,101,'LOGIN','Connexion réussie de Elie NGUEMA OVONO',NULL,'2026-04-02 16:46:51');
INSERT INTO "audit_logs" VALUES(63,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 16:48:02');
INSERT INTO "audit_logs" VALUES(64,100,'LOGIN_FAILED','Tentative de connexion échouée pour Jean-Marc DIRECTEUR depuis IP 10.64.169.174',NULL,'2026-04-02 16:48:53');
INSERT INTO "audit_logs" VALUES(65,100,'LOGIN','Connexion réussie de Jean-Marc DIRECTEUR',NULL,'2026-04-02 16:49:04');
INSERT INTO "audit_logs" VALUES(66,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.60.154',NULL,'2026-04-02 18:56:38');
INSERT INTO "audit_logs" VALUES(67,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 18:56:41');
INSERT INTO "audit_logs" VALUES(68,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-02 19:58:15');
INSERT INTO "audit_logs" VALUES(69,1,'UPDATE_USER','Modification de l''utilisateur ID 100',NULL,'2026-04-02 19:59:11');
INSERT INTO "audit_logs" VALUES(70,1,'UPDATE_USER','Modification de l''utilisateur ID 100',NULL,'2026-04-02 20:00:23');
INSERT INTO "audit_logs" VALUES(71,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-02 20:00:59');
INSERT INTO "audit_logs" VALUES(72,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-02 21:02:44');
INSERT INTO "audit_logs" VALUES(73,101,'LOGIN','Connexion réussie de Elie NGUEMA OVONO',NULL,'2026-04-03 07:32:21');
INSERT INTO "audit_logs" VALUES(74,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-03 07:33:52');
INSERT INTO "audit_logs" VALUES(75,102,'LOGIN_FAILED','Tentative de connexion échouée pour Jean TAHITI depuis IP 10.64.164.248',NULL,'2026-04-03 07:35:22');
INSERT INTO "audit_logs" VALUES(76,102,'LOGIN_FAILED','Tentative de connexion échouée pour Jean TAHITI depuis IP 10.64.164.248',NULL,'2026-04-03 07:35:31');
INSERT INTO "audit_logs" VALUES(77,102,'LOGIN','Connexion réussie de Jean TAHITI',NULL,'2026-04-03 07:36:08');
INSERT INTO "audit_logs" VALUES(78,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-03 07:37:01');
INSERT INTO "audit_logs" VALUES(79,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-03 07:42:00');
INSERT INTO "audit_logs" VALUES(80,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-03 07:46:23');
INSERT INTO "audit_logs" VALUES(81,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 10:07:13');
INSERT INTO "audit_logs" VALUES(82,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 10:07:28');
INSERT INTO "audit_logs" VALUES(83,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 10:07:28');
INSERT INTO "audit_logs" VALUES(84,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 10:07:36');
INSERT INTO "audit_logs" VALUES(85,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:25:42');
INSERT INTO "audit_logs" VALUES(86,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.164.248',NULL,'2026-04-07 10:27:34');
INSERT INTO "audit_logs" VALUES(87,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.164.248',NULL,'2026-04-07 10:27:34');
INSERT INTO "audit_logs" VALUES(88,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.164.248',NULL,'2026-04-07 10:27:36');
INSERT INTO "audit_logs" VALUES(89,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 10:27:52');
INSERT INTO "audit_logs" VALUES(90,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 10:28:36');
INSERT INTO "audit_logs" VALUES(91,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 10:29:18');
INSERT INTO "audit_logs" VALUES(92,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:29:59');
INSERT INTO "audit_logs" VALUES(93,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:30:07');
INSERT INTO "audit_logs" VALUES(94,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:30:14');
INSERT INTO "audit_logs" VALUES(95,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:30:26');
INSERT INTO "audit_logs" VALUES(96,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:30:31');
INSERT INTO "audit_logs" VALUES(97,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:31:35');
INSERT INTO "audit_logs" VALUES(98,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:33:16');
INSERT INTO "audit_logs" VALUES(99,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:33:29');
INSERT INTO "audit_logs" VALUES(100,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:34:10');
INSERT INTO "audit_logs" VALUES(101,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:34:57');
INSERT INTO "audit_logs" VALUES(102,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:35:58');
INSERT INTO "audit_logs" VALUES(103,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:50:56');
INSERT INTO "audit_logs" VALUES(104,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:51:41');
INSERT INTO "audit_logs" VALUES(105,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:51:56');
INSERT INTO "audit_logs" VALUES(106,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 10:56:58');
INSERT INTO "audit_logs" VALUES(107,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.164.248',NULL,'2026-04-07 11:12:20');
INSERT INTO "audit_logs" VALUES(108,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 11:12:42');
INSERT INTO "audit_logs" VALUES(109,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 11:26:17');
INSERT INTO "audit_logs" VALUES(110,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 11:34:41');
INSERT INTO "audit_logs" VALUES(111,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 11:38:31');
INSERT INTO "audit_logs" VALUES(112,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 12:14:09');
INSERT INTO "audit_logs" VALUES(113,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 12:47:44');
INSERT INTO "audit_logs" VALUES(114,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 12:47:51');
INSERT INTO "audit_logs" VALUES(115,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 12:47:59');
INSERT INTO "audit_logs" VALUES(116,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-07 15:09:40');
INSERT INTO "audit_logs" VALUES(117,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:09:59');
INSERT INTO "audit_logs" VALUES(118,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:10:09');
INSERT INTO "audit_logs" VALUES(119,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-07 15:21:43');
INSERT INTO "audit_logs" VALUES(120,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:23:12');
INSERT INTO "audit_logs" VALUES(121,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-07 15:26:47');
INSERT INTO "audit_logs" VALUES(122,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:29:13');
INSERT INTO "audit_logs" VALUES(123,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:35:53');
INSERT INTO "audit_logs" VALUES(124,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:38:47');
INSERT INTO "audit_logs" VALUES(125,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 15:41:34');
INSERT INTO "audit_logs" VALUES(126,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 15:42:20');
INSERT INTO "audit_logs" VALUES(127,5,'VALIDATION','Session #6 validée',NULL,'2026-04-07 15:43:02');
INSERT INTO "audit_logs" VALUES(128,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:45:43');
INSERT INTO "audit_logs" VALUES(129,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-07 15:46:05');
INSERT INTO "audit_logs" VALUES(130,2,'LOGIN','Connexion réussie de Marc NZOGHE',NULL,'2026-04-07 15:46:06');
INSERT INTO "audit_logs" VALUES(131,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:46:06');
INSERT INTO "audit_logs" VALUES(132,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 15:46:06');
INSERT INTO "audit_logs" VALUES(133,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 15:46:07');
INSERT INTO "audit_logs" VALUES(134,4,'LOGIN_FAILED','Tentative de connexion échouée pour Eliel KAPOU depuis IP 10.64.117.90',NULL,'2026-04-07 15:47:00');
INSERT INTO "audit_logs" VALUES(135,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:48:38');
INSERT INTO "audit_logs" VALUES(136,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 15:50:37');
INSERT INTO "audit_logs" VALUES(137,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:50:54');
INSERT INTO "audit_logs" VALUES(138,4,'LOGIN','Connexion réussie de Eliel KAPOU',NULL,'2026-04-07 15:53:33');
INSERT INTO "audit_logs" VALUES(139,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 15:56:42');
INSERT INTO "audit_logs" VALUES(140,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 15:59:58');
INSERT INTO "audit_logs" VALUES(141,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 16:04:58');
INSERT INTO "audit_logs" VALUES(142,5,'LOGIN','Connexion réussie de Ingara MAIDOU',NULL,'2026-04-07 16:07:58');
INSERT INTO "audit_logs" VALUES(143,100,'LOGIN','Connexion réussie de Hervé Ghislain  KOGBOMA',NULL,'2026-04-07 17:32:49');
INSERT INTO "audit_logs" VALUES(144,101,'LOGIN','Connexion réussie de Elie NGUEMA OVONO',NULL,'2026-04-07 17:36:38');
INSERT INTO "audit_logs" VALUES(145,103,'LOGIN','Connexion réussie de Marie BAGAZA',NULL,'2026-04-07 17:37:50');
INSERT INTO "audit_logs" VALUES(146,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:32:29');
INSERT INTO "audit_logs" VALUES(147,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:33:17');
INSERT INTO "audit_logs" VALUES(148,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:35:18');
INSERT INTO "audit_logs" VALUES(149,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:37:46');
INSERT INTO "audit_logs" VALUES(150,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:38:21');
INSERT INTO "audit_logs" VALUES(151,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 10.64.153.12',NULL,'2026-04-08 09:38:59');
INSERT INTO "audit_logs" VALUES(152,1,'LOGIN_FAILED','Tentative de connexion échouée pour Fayolle KOBA depuis IP 127.0.0.1',NULL,'2026-04-08 09:39:13');
INSERT INTO "audit_logs" VALUES(153,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-08 09:42:58');
INSERT INTO "audit_logs" VALUES(154,1,'LOGIN','Connexion réussie de Fayolle KOBA',NULL,'2026-04-08 09:44:24');
INSERT INTO "audit_logs" VALUES(155,1,'UPDATE_USER','Modification de l''utilisateur ID 1',NULL,'2026-04-08 09:45:39');
DELETE FROM sqlite_sequence;
INSERT INTO "sqlite_sequence" VALUES('d1_migrations',6);
INSERT INTO "sqlite_sequence" VALUES('strategic_objectives',12);
INSERT INTO "sqlite_sequence" VALUES('departments',9);
INSERT INTO "sqlite_sequence" VALUES('processes',14);
INSERT INTO "sqlite_sequence" VALUES('tasks',59);
INSERT INTO "sqlite_sequence" VALUES('users',103);
INSERT INTO "sqlite_sequence" VALUES('audit_logs',155);
INSERT INTO "sqlite_sequence" VALUES('work_sessions',297);
CREATE INDEX idx_work_sessions_user_id ON work_sessions(user_id);
CREATE INDEX idx_work_sessions_status ON work_sessions(status);
CREATE INDEX idx_work_sessions_objective ON work_sessions(objective_id);
CREATE INDEX idx_work_sessions_department ON work_sessions(department_id);
CREATE INDEX idx_tasks_department ON tasks(department_id);
CREATE INDEX idx_processes_department ON processes(department_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_users_works_saturday ON users(works_saturday);