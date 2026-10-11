# CORTEX OS

Bóveda personal cifrada con interfaz de sistema operativo tipo HUD: escritorio con ventanas, dock, buscador (Ctrl+K), terminal y menús de clic derecho. Contraseñas, tarjetas, fichas de identidad, drive con carpetas, autenticador 2FA, notas, contactos y papelera.

## Cómo protege tus datos

- **Cifrado de conocimiento cero.** Todo se cifra en tu navegador con AES-256-GCM antes de llegar a Firebase. La clave sale de tu contraseña maestra (PBKDF2, 600.000 iteraciones) combinada con tu archivo llave `.json` (HKDF). Firebase solo guarda bloques ilegibles.
- **Sin cuenta de Google:** para entrar hacen falta tu contraseña maestra y tu archivo llave. De ellos salen, por separado, la clave de cifrado y la cuenta de Firebase, así que sin los dos no se puede ni iniciar sesión ni descifrar.
- **Reglas de Firestore:** cada bóveda solo la puede leer y escribir su dueño (`firestore.rules`). La sesión se cierra al bloquear, recargar o cerrar la pestaña.
- **Bloqueo por intentos:** tras 5 fallos, 5 min de espera que se duplican con cada fallo extra.
- **Bloqueo por inactividad** y al volver a la pestaña tras más de 1 min.
- **Registro de entradas:** cada entrada, fallo y bloqueo con fecha y dispositivo.
- **Portapapeles:** los datos copiados se borran solos a los 30 s.
- **Papelera:** lo que borras se guarda 30 días y se puede restaurar; también hay «Deshacer» al momento.
- **Autenticador 2FA:** genera los códigos de verificación (TOTP, RFC 6238) a partir de claves guardadas cifradas.
- **Archivo llave protegido:** el archivo llave puede llevar su propia contraseña (PBKDF2 600.000 + AES-256-GCM). Si alguien lo copia de tu USB no le sirve sin ella.

> Si pierdes la contraseña **o** el archivo llave, los datos no se pueden recuperar. Guarda el archivo llave en dos sitios.

## Archivos (sin plan Blaze)

Los archivos se trocean en partes de 700 KB, se cifran y se guardan en Firestore. Máximo 25 MB por archivo. El plan gratuito de Firestore incluye 1 GiB de almacenamiento.

## Estructura

```
index.html
css/styles.css
assets/          logo del cerebro e iconos
js/app.js        arranque, pantalla de acceso y sesión
js/os.js         escritorio, ventanas, dock y buscador
js/apps.js       apps (contraseñas, tarjetas, identidad, drive, terminal…)
js/brain.js      destellos que recorren las fibras del cerebro
js/sphere.js     esfera neuronal 3D generada por código (fondo del escritorio)
js/icons.js      iconos de las apps
js/decoder.js    secuencia de entrada (decodificador y ACCESS GRANTED)
js/ui.js         utilidades de interfaz
js/state.js      estado de la sesión y guardado cifrado
js/crypto.js     cifrado, archivo llave y generador
js/store.js      Firebase (Auth sin Google + Firestore)
js/templates.js  modelos de fichas de identidad
js/config.js     configuración web del proyecto marela
firestore.rules  reglas de seguridad
```

Las fichas de identidad son de consulta personal y no reproducen el diseño de ningún documento oficial.
