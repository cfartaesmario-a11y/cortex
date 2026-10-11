// Plantillas de fichas. Son fichas de consulta propias de CORTEX:
// no reproducen el diseño de ningún documento oficial.

export const ID_TEMPLATES = [
  {
    id: "dni-es", name: "DNI", region: "España", group: "España",
    fields: [
      ["numero", "Número de DNI"], ["apellido1", "Primer apellido"], ["apellido2", "Segundo apellido"],
      ["nombre", "Nombre"], ["sexo", "Sexo"], ["nacionalidad", "Nacionalidad"], ["nacimiento", "Fecha de nacimiento", "date"],
      ["expedicion", "Fecha de expedición", "date"], ["validez", "Válido hasta", "date"], ["soporte", "Nº de soporte"],
      ["lugarNac", "Lugar de nacimiento"], ["domicilio", "Domicilio"], ["padres", "Hijo/a de"],
    ],
    main: "numero",
  },
  {
    id: "nie-es", name: "NIE / TIE", region: "España", group: "España",
    fields: [
      ["numero", "NIE"], ["apellidos", "Apellidos"], ["nombre", "Nombre"], ["nacionalidad", "Nacionalidad"],
      ["nacimiento", "Fecha de nacimiento", "date"], ["sexo", "Sexo"], ["tipo", "Tipo de permiso"],
      ["expedicion", "Fecha de expedición", "date"], ["validez", "Válido hasta", "date"], ["soporte", "Nº de soporte"],
      ["domicilio", "Domicilio"],
    ],
    main: "numero",
  },
  {
    id: "pasaporte-es", name: "Pasaporte", region: "España", group: "España",
    fields: [
      ["numero", "Nº de pasaporte"], ["apellidos", "Apellidos"], ["nombre", "Nombre"], ["nacionalidad", "Nacionalidad"],
      ["nacimiento", "Fecha de nacimiento", "date"], ["lugarNac", "Lugar de nacimiento"], ["sexo", "Sexo"],
      ["expedicion", "Fecha de expedición", "date"], ["validez", "Válido hasta", "date"], ["autoridad", "Autoridad"],
      ["dni", "DNI asociado"],
    ],
    main: "numero",
  },
  {
    id: "carnet-es", name: "Permiso de conducir", region: "España", group: "España",
    fields: [
      ["numero", "Número"], ["apellidos", "Apellidos"], ["nombre", "Nombre"], ["nacimiento", "Fecha de nacimiento", "date"],
      ["expedicion", "Fecha de expedición", "date"], ["validez", "Válido hasta", "date"], ["clases", "Clases (B, A2…)"],
      ["puntos", "Puntos"],
    ],
    main: "numero",
  },
  {
    id: "sanitaria-es", name: "Tarjeta sanitaria", region: "España", group: "España",
    fields: [
      ["cip", "Código CIP / TSI"], ["nombre", "Nombre completo"], ["cap", "Centro de salud (CAP)"],
      ["medico", "Médico de cabecera"], ["validez", "Válida hasta", "date"],
    ],
    main: "cip",
  },
  {
    id: "nss-es", name: "Seguridad Social", region: "España", group: "España",
    fields: [["nss", "Nº de afiliación (NSS)"], ["nombre", "Nombre completo"], ["alta", "Fecha de alta", "date"]],
    main: "nss",
  },
  {
    id: "ci-ro", name: "Carte de identitate", region: "Rumanía", group: "Rumanía",
    fields: [
      ["cnp", "CNP"], ["serie", "Serie"], ["numar", "Număr"], ["nume", "Nume (apellido)"], ["prenume", "Prenume (nombre)"],
      ["cetatenie", "Cetățenie (nacionalidad)"], ["nastere", "Data nașterii", "date"], ["loculNasterii", "Locul nașterii"],
      ["sex", "Sex"], ["domiciliu", "Domiciliu"], ["emisa", "Emisă de"], ["eliberare", "Data eliberării", "date"],
      ["valabilitate", "Valabilă până la", "date"],
    ],
    main: "cnp",
  },
  {
    id: "pasaport-ro", name: "Pașaport", region: "Rumanía", group: "Rumanía",
    fields: [
      ["numar", "Nr. pașaport"], ["nume", "Nume"], ["prenume", "Prenume"], ["cnp", "CNP"], ["cetatenie", "Cetățenie"],
      ["nastere", "Data nașterii", "date"], ["loculNasterii", "Locul nașterii"], ["sex", "Sex"],
      ["eliberare", "Data eliberării", "date"], ["valabilitate", "Valabil până la", "date"], ["autoritate", "Autoritate"],
    ],
    main: "numar",
  },
  {
    id: "permis-ro", name: "Permis de conducere", region: "Rumanía", group: "Rumanía",
    fields: [
      ["numar", "Număr"], ["nume", "Nume"], ["prenume", "Prenume"], ["nastere", "Data nașterii", "date"],
      ["eliberare", "Data eliberării", "date"], ["valabilitate", "Valabil până la", "date"], ["categorii", "Categorii"],
    ],
    main: "numar",
  },
  {
    id: "certificat-ro", name: "Certificat de naștere", region: "Rumanía", group: "Rumanía",
    fields: [
      ["serie", "Serie și număr"], ["nume", "Nume"], ["prenume", "Prenume"], ["cnp", "CNP"], ["nastere", "Data nașterii", "date"],
      ["loc", "Locul nașterii"], ["tata", "Tatăl"], ["mama", "Mama"],
    ],
    main: "serie",
  },
  {
    id: "persona", name: "Datos personales", region: "General", group: "General",
    fields: [
      ["nombre", "Nombre completo"], ["nacimiento", "Fecha de nacimiento", "date"], ["telefono", "Teléfono"],
      ["email", "Correo"], ["direccion", "Dirección"], ["cp", "Código postal"], ["sangre", "Grupo sanguíneo"],
      ["notas", "Notas", "area"],
    ],
    main: "nombre",
  },
  {
    id: "libre", name: "Documento libre", region: "General", group: "General",
    fields: [
      ["titulo", "Nombre del documento"], ["numero", "Número"], ["titular", "Titular"], ["expedicion", "Expedición", "date"],
      ["validez", "Validez", "date"], ["notas", "Notas", "area"],
    ],
    main: "numero",
  },
];

export const tpl = (id) => ID_TEMPLATES.find((t) => t.id === id) || ID_TEMPLATES[ID_TEMPLATES.length - 1];
