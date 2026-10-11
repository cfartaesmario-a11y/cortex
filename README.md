# CORTEX

Bóveda personal cifrada: contraseñas, tarjetas, fichas de identidad, drive de archivos, notas y contactos.

## Cómo protege tus datos

- **Cifrado de conocimiento cero.** Todo se cifra en tu navegador con AES-256-GCM antes de llegar a Firebase. La clave sale de tu contraseña maestra (PBKDF2, 600.000 iteraciones) combinada con tu archivo llave `.json` (HKDF). Firebase solo guarda bloques ilegibles.
- **Sin cuenta de Google:** para entrar hacen falta tu contraseña maestra y tu archivo llave. De ellos salen, por separado, la clave de cifrado y la cuenta de Firebase, así que sin los dos no se puede ni iniciar sesión ni descifrar.
- **Reglas de Firestore:** cada bóveda solo la puede leer y escribir su dueño (`firestore.rules`). La sesión se cierra al bloquear, recargar o cerrar la pestaña.
- **Bloqueo por intentos:** tras 5 fallos, 5 min de espera que se duplican con cada fallo extra.
- **Bloqueo por inactividad** y al volver a la pestaña tras más de 1 min.
- **Registro de entradas:** cada entrada, fallo y bloqueo con fecha y dispositivo.
- **Portapapeles:** los datos copiados se borran solos a los 30 s.

> Si pierdes la contraseña **o** el archivo llave, los datos no se pueden recuperar. Guarda el archivo llave en dos sitios.

## Archivos (sin plan Blaze)

Los archivos se trocean en partes de 700 KB, se cifran y se guardan en Firestore. Máximo 25 MB por archivo. El plan gratuito de Firestore incluye 1 GiB de almacenamiento.

## Estructura

```
index.html
css/styles.css
js/app.js        interfaz
js/crypto.js     cifrado y generador
js/store.js      Firebase (Auth sin Google + Firestore)
js/templates.js  modelos de fichas de identidad
js/config.js     configuración web del proyecto marela
firestore.rules  reglas de seguridad
```

Las fichas de identidad son de consulta personal y no reproducen el diseño de ningún documento oficial.
