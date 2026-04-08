# Configuration Nginx - TimeTrack BGFIBank

## Installation rapide (Ubuntu/Debian)

```bash
# 1. Installer Nginx
sudo apt update
sudo apt install nginx

# 2. Copier la configuration
sudo cp timetrack.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/timetrack.conf /etc/nginx/sites-enabled/

# 3. Générer certificat Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot certonly --nginx -d timetrack.bgfibank.com

# 4. Générer DH params (optionnel, améliore sécurité)
sudo mkdir -p /etc/nginx/ssl
sudo openssl dhparam -out /etc/nginx/ssl/dhparam.pem 2048

# 5. Tester configuration
sudo nginx -t

# 6. Redémarrer Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx  # Démarrage auto au boot

# 7. Vérifier certificat SSL (optionnel)
sudo certbot certificates
```

## Renouvellement automatique du certificat

Let's Encrypt certbot configure automatiquement un cron job. Vérifier avec :

```bash
sudo systemctl status certbot.timer
```

Test manuel du renouvellement :
```bash
sudo certbot renew --dry-run
```

## Test de sécurité SSL

Vérifier la note SSL avec SSLLabs :
- https://www.ssllabs.com/ssltest/analyze.html?d=timetrack.bgfibank.com
- Note attendue : **A+** avec configuration fournie

## Vérifier HSTS

```bash
curl -I https://timetrack.bgfibank.com | grep Strict-Transport-Security
```

Résultat attendu :
```
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
```

## Logs

```bash
# Logs accès (toutes les requêtes)
sudo tail -f /var/log/nginx/timetrack-access.log

# Logs erreurs
sudo tail -f /var/log/nginx/timetrack-error.log
```

## Firewall (UFW)

```bash
# Autoriser HTTP + HTTPS
sudo ufw allow 'Nginx Full'

# Bloquer HTTP direct sur port 3000 (sécurité)
sudo ufw deny 3000/tcp

# Vérifier statut
sudo ufw status
```

## Notes de production

1. **Domaine** : Remplacer `timetrack.bgfibank.com` par votre domaine réel dans `timetrack.conf`
2. **Backend** : S'assurer que Node.js écoute sur `localhost:3000` (via PM2)
3. **Logs** : Rotation automatique des logs via logrotate (déjà configuré par Nginx)
4. **Monitoring** : Ajouter nginx-prometheus-exporter si monitoring APM requis

## Commandes utiles

```bash
# Recharger config sans downtime
sudo nginx -s reload

# Tester syntaxe config
sudo nginx -t

# Statut Nginx
sudo systemctl status nginx

# Redémarrer Nginx
sudo systemctl restart nginx

# Voir processus Nginx
ps aux | grep nginx
```

## Troubleshooting

**Erreur "Address already in use"** :
```bash
sudo lsof -i :80
sudo lsof -i :443
sudo pkill nginx  # Si nécessaire
```

**Certificat SSL expiré** :
```bash
sudo certbot renew --force-renewal
sudo systemctl restart nginx
```

**Backend inaccessible** :
```bash
# Vérifier que Node.js tourne
pm2 list
pm2 logs timetrack

# Tester direct (bypass Nginx)
curl http://localhost:3000/api/auth/me
```
