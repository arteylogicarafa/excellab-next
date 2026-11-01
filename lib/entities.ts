// Definición de las entidades administrables (réplica de app/Core/Entities.php).

export interface EntityField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'html' | 'json' | 'password' | 'number' | 'select' | 'checks';
  required?: boolean;
  virtual?: boolean;
  nullable?: boolean;
  default?: string | number;
  max?: number;
  min?: number;
  step?: string;
  col?: number;
  rows?: number;
  pattern?: string;
  help?: string;
  options?: Record<string | number, string>;
  sql?: string;
}

export interface EntityDef {
  table: string;
  title: string;
  singular: string;
  icon: string;
  fixed?: Record<string, string | number>;
  where?: string;
  sql: string;
  order: string;
  search: string[];
  columns: [string, string, string?][];
  extra_actions?: [string, string, string][];
  preview?: string;
  filters?: [string, string, string | Record<string, string>, string][];
  fields: EntityField[];
  hooks?: string;
  admin_only?: boolean;
}

const statusField: EntityField = { name: 'status', label: 'Estado', type: 'select', options: statusOptions(), default: 'active' };

function statusOptions(): Record<string, string> {
  return { active: 'Activo', inactive: 'Inactivo', archived: 'Archivado' };
}

const DIFF: Record<string, string> = { basico: 'Básico', intermedio: 'Intermedio', avanzado: 'Avanzado' };

export function statusOptionsPublic(): Record<string, string> {
  return statusOptions();
}

const JSON_HELP =
  'JSON con el formato {"headers":["A","B"],"rows":[["x",1],["y",2]]}. Se muestra como hoja de Excel.';

export function entities(): Record<string, EntityDef> {
  return {
    estudiantes: {
      table: 'users',
      title: 'Estudiantes',
      singular: 'estudiante',
      icon: 'bi-people',
      fixed: { role_id: 3 },
      where: 'u.role_id=3',
      sql: 'SELECT u.id, u.name, u.email, u.status, u.last_login_at, u.must_change_password FROM users u',
      order: 'u.name',
      search: ['u.name', 'u.email'],
      columns: [
        ['name', 'Nombre'],
        ['email', 'Correo'],
        ['last_login_at', 'Último acceso', 'date'],
        ['must_change_password', 'Clave', 'pwd'],
      ],
      extra_actions: [['admin/seguimiento/{id}', 'bi-graph-up-arrow', 'Ver progreso']],
      fields: [
        { name: 'name', label: 'Nombre completo', type: 'text', required: true, max: 120, min: 3 },
        { name: 'email', label: 'Correo electrónico', type: 'email', required: true, max: 150 },
        statusField,
      ],
      hooks: 'users',
    },
    usuarios: {
      table: 'users',
      title: 'Docentes y administradores',
      singular: 'usuario',
      icon: 'bi-person-gear',
      admin_only: true,
      where: 'u.role_id IN (1,2)',
      sql: 'SELECT u.id, u.name, u.email, u.status, u.last_login_at, r.label AS role FROM users u JOIN roles r ON r.id=u.role_id',
      order: 'u.role_id, u.name',
      search: ['u.name', 'u.email'],
      columns: [
        ['name', 'Nombre'],
        ['email', 'Correo'],
        ['role', 'Rol'],
        ['last_login_at', 'Último acceso', 'date'],
      ],
      fields: [
        { name: 'name', label: 'Nombre completo', type: 'text', required: true, max: 120, min: 3 },
        { name: 'email', label: 'Correo electrónico', type: 'email', required: true, max: 150 },
        { name: 'role_id', label: 'Rol', type: 'select', options: { 1: 'Administrador', 2: 'Docente' }, required: true, default: 2 },
        { name: 'password', label: 'Contraseña inicial', type: 'password', virtual: true, help: 'Deberá cambiarla en su primer acceso. Déjalo vacío al editar para no modificarla.' },
        statusField,
      ],
      hooks: 'users',
    },
    modulos: {
      table: 'modules',
      title: 'Módulos',
      singular: 'módulo',
      icon: 'bi-collection',
      sql: 'SELECT m.*, (SELECT COUNT(*) FROM lessons l WHERE l.module_id=m.id) AS lessons FROM modules m',
      order: 'm.position, m.id',
      search: ['m.title', 'm.description'],
      columns: [
        ['position', '#'],
        ['title', 'Título'],
        ['lessons', 'Lecciones'],
      ],
      fields: [
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'description', label: 'Descripción', type: 'textarea', rows: 3 },
        { name: 'icon', label: 'Icono (Bootstrap Icons)', type: 'text', default: 'bi-table', max: 40, help: 'Por ejemplo: bi-calculator, bi-bar-chart-line, bi-briefcase' },
        { name: 'position', label: 'Orden', type: 'number', default: 1, min: 1 },
        statusField,
      ],
    },
    lecciones: {
      table: 'lessons',
      title: 'Lecciones',
      singular: 'lección',
      icon: 'bi-journal-text',
      sql: 'SELECT l.*, m.title AS module_title FROM lessons l JOIN modules m ON m.id=l.module_id',
      order: 'm.position, l.position, l.id',
      search: ['l.title', 'l.description'],
      filters: [['module_id', 'Módulo', 'SELECT id, title FROM modules ORDER BY position', 'l.module_id']],
      columns: [
        ['module_title', 'Módulo'],
        ['position', '#'],
        ['title', 'Lección'],
      ],
      preview: 'aprender/leccion/{id}',
      fields: [
        { name: 'module_id', label: 'Módulo', type: 'select', sql: 'SELECT id, title FROM modules ORDER BY position', required: true },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'description', label: 'Descripción breve', type: 'text', max: 300 },
        { name: 'theory', label: 'Explicación teórica (HTML básico)', type: 'html', rows: 9, help: 'Etiquetas permitidas: p, ul, ol, li, strong, em, code, kbd, h4, table, br.' },
        { name: 'example', label: 'Ejemplo práctico (HTML básico)', type: 'html', rows: 4 },
        { name: 'example_data', label: 'Hoja de ejemplo (JSON)', type: 'json', rows: 4, help: JSON_HELP },
        { name: 'image_url', label: 'Imagen o ilustración (ruta o URL)', type: 'text', max: 255, help: 'Ejemplo: assets/img/grafico-barras.svg' },
        { name: 'position', label: 'Orden dentro del módulo', type: 'number', default: 1, min: 1 },
        statusField,
      ],
    },
    ejercicios: {
      table: 'exercises',
      title: 'Ejercicios',
      singular: 'ejercicio',
      icon: 'bi-pencil-square',
      sql: 'SELECT e.*, m.title AS module_title FROM exercises e JOIN modules m ON m.id=e.module_id',
      order: 'm.position, e.id',
      search: ['e.title', 'e.statement', 'e.topic'],
      filters: [
        ['module_id', 'Módulo', 'SELECT id, title FROM modules ORDER BY position', 'e.module_id'],
        ['difficulty', 'Dificultad', DIFF, 'e.difficulty'],
      ],
      columns: [
        ['module_title', 'Módulo'],
        ['title', 'Ejercicio'],
        ['type', 'Tipo', 'type'],
        ['difficulty', 'Nivel', 'diff'],
        ['points', 'Pts'],
      ],
      preview: 'laboratorio/{id}',
      hooks: 'exercises',
      fields: [
        { name: 'module_id', label: 'Módulo', type: 'select', sql: 'SELECT id, title FROM modules ORDER BY position', required: true },
        { name: 'lesson_id', label: 'Lección asociada (opcional)', type: 'select', sql: "SELECT l.id, m.title || ' › ' || l.title FROM lessons l JOIN modules m ON m.id=l.module_id ORDER BY m.position, l.position", nullable: true, help: 'Si eliges una lección, el ejercicio aparece como su ejercicio de comprobación.' },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'topic', label: 'Tema', type: 'text', required: true, max: 100 },
        { name: 'difficulty', label: 'Dificultad', type: 'select', options: DIFF, default: 'basico', required: true, col: 6 },
        {
          name: 'type', label: 'Tipo de actividad', type: 'select', required: true, col: 6,
          options: {
            multiple_choice: 'Selección múltiple', true_false: 'Verdadero o falso', complete_formula: 'Completar fórmula',
            identify_function: 'Identificar función', solve_operation: 'Resolver operación', analyze_table: 'Analizar tabla de datos',
            practical: 'Situación práctica',
          },
        },
        { name: 'statement', label: 'Enunciado', type: 'textarea', required: true, rows: 3 },
        { name: 'instructions', label: 'Instrucciones (opcional)', type: 'textarea', rows: 2 },
        { name: 'data_json', label: 'Datos necesarios (JSON, opcional)', type: 'json', rows: 4, help: JSON_HELP },
        { name: 'answer_kind', label: 'Tipo de respuesta', type: 'select', required: true, default: 'option', options: { option: 'Alternativas (opción correcta)', number: 'Número', formula: 'Fórmula', text: 'Texto' }, col: 6 },
        { name: 'tolerance', label: 'Tolerancia (respuestas numéricas)', type: 'number', step: '0.01', default: 0.01, min: 0, col: 6 },
        { name: 'options_text', label: 'Alternativas (una por línea; marca la correcta con * al inicio)', type: 'textarea', virtual: true, rows: 5, help: 'Ejemplo: *Verdadero (correcta) y en otra línea Falso. Solo para respuestas con alternativas.' },
        { name: 'correct_answer', label: 'Respuesta correcta (número, fórmula o texto)', type: 'text', max: 500, help: 'Puedes separar alternativas válidas con ||. Ej: =SUMA(B2:B6)||=SUM(B2:B6)' },
        { name: 'explanation', label: 'Explicación de la respuesta correcta', type: 'textarea', rows: 3 },
        { name: 'points', label: 'Puntuación', type: 'number', default: 10, min: 1, max: 1000 },
        statusField,
      ],
    },
    retos: {
      table: 'challenges',
      title: 'Retos (Excel Challenge)',
      singular: 'reto',
      icon: 'bi-trophy',
      sql: 'SELECT c.* FROM challenges c',
      order: 'c.position, c.id',
      search: ['c.title', 'c.situation'],
      filters: [['difficulty', 'Dificultad', DIFF, 'c.difficulty']],
      columns: [
        ['position', '#'],
        ['title', 'Reto'],
        ['difficulty', 'Nivel', 'diff'],
        ['est_minutes', 'Min'],
        ['points', 'Pts'],
      ],
      preview: 'retos/{id}',
      fields: [
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'difficulty', label: 'Dificultad', type: 'select', options: DIFF, required: true, default: 'basico' },
        { name: 'situation', label: 'Descripción de la situación', type: 'textarea', required: true, rows: 3 },
        { name: 'objective', label: 'Objetivo', type: 'text', required: true, max: 300 },
        { name: 'data_json', label: 'Datos de entrada (JSON)', type: 'json', rows: 4, help: JSON_HELP },
        { name: 'instructions', label: 'Instrucciones', type: 'textarea', rows: 3 },
        { name: 'est_minutes', label: 'Tiempo estimado (min)', type: 'number', default: 10, min: 1, max: 600, col: 6 },
        { name: 'points', label: 'Puntuación', type: 'number', default: 30, min: 1, max: 1000, col: 6 },
        { name: 'answer_kind', label: 'Tipo de respuesta', type: 'select', options: { number: 'Número', text: 'Texto', formula: 'Fórmula' }, default: 'number', required: true, col: 6 },
        { name: 'tolerance', label: 'Tolerancia numérica', type: 'number', step: '0.01', default: 0.01, min: 0, col: 6 },
        { name: 'correct_answer', label: 'Respuesta correcta', type: 'text', required: true, max: 500, help: 'Admite alternativas separadas por ||.' },
        { name: 'hint', label: 'Pista (opcional)', type: 'text', max: 300 },
        { name: 'feedback_ok', label: 'Retroalimentación si acierta', type: 'text', max: 400 },
        { name: 'feedback_fail', label: 'Retroalimentación si falla', type: 'text', max: 400 },
        { name: 'position', label: 'Orden', type: 'number', default: 1, min: 1 },
        statusField,
      ],
    },
    casos: {
      table: 'practical_cases',
      title: 'Casos prácticos',
      singular: 'caso',
      icon: 'bi-briefcase',
      sql: 'SELECT c.* FROM practical_cases c',
      order: 'c.category, c.id',
      search: ['c.title', 'c.context'],
      filters: [
        ['category', 'Categoría', { Administración: 'Administración', Ventas: 'Ventas', Inventario: 'Inventario', 'Recursos Humanos': 'Recursos Humanos', Educación: 'Educación' }, 'c.category'],
      ],
      columns: [
        ['category', 'Categoría'],
        ['title', 'Caso'],
        ['mode', 'Modalidad', 'mode'],
        ['points', 'Pts'],
      ],
      preview: 'casos/{id}',
      hooks: 'cases',
      fields: [
        { name: 'category', label: 'Categoría', type: 'select', required: true, options: { Administración: 'Administración', Ventas: 'Ventas', Inventario: 'Inventario', 'Recursos Humanos': 'Recursos Humanos', Educación: 'Educación' } },
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'context', label: 'Contexto', type: 'textarea', required: true, rows: 3 },
        { name: 'problem', label: 'Problema a resolver', type: 'textarea', required: true, rows: 3 },
        { name: 'data_json', label: 'Datos de trabajo (JSON)', type: 'json', rows: 5, help: JSON_HELP + ' También se usa para generar la plantilla de Excel descargable.' },
        { name: 'instructions', label: 'Instrucciones', type: 'textarea', rows: 3 },
        { name: 'criteria', label: 'Criterios de evaluación', type: 'textarea', rows: 3 },
        { name: 'mode', label: 'Modalidad', type: 'select', required: true, default: 'platform', options: { platform: 'Se resuelve en la plataforma', file: 'Entrega de archivo Excel' } },
        { name: 'questions_json', label: 'Preguntas con respuesta (modalidad plataforma)', type: 'json', rows: 6, help: 'JSON: [{"label":"Total de gastos","answer":"955.5","kind":"number","tolerance":0.01},{"label":"Mayor gasto","answer":"Alquiler","kind":"text"}]' },
        { name: 'points', label: 'Puntuación', type: 'number', default: 50, min: 1, max: 1000 },
        statusField,
      ],
    },
    evaluaciones: {
      table: 'assessments',
      title: 'Evaluaciones',
      singular: 'evaluación',
      icon: 'bi-clipboard-check',
      sql: "SELECT a.*, m.title AS module_title, (SELECT COUNT(*) FROM assessment_questions q WHERE q.assessment_id=a.id) AS pool, (SELECT COUNT(*) FROM assessment_attempts t WHERE t.assessment_id=a.id AND t.status<>'in_progress') AS tries FROM assessments a LEFT JOIN modules m ON m.id=a.module_id",
      order: '(a.module_id IS NULL), m.position, a.id',
      search: ['a.title'],
      columns: [
        ['title', 'Evaluación'],
        ['module_title', 'Módulo'],
        ['pool', 'Banco'],
        ['time_limit_min', 'Min'],
        ['pass_percent', 'Aprueba %'],
        ['tries', 'Intentos'],
      ],
      preview: 'evaluaciones/{id}',
      hooks: 'assessments',
      fields: [
        { name: 'title', label: 'Título', type: 'text', required: true, max: 150 },
        { name: 'module_id', label: 'Módulo (opcional)', type: 'select', sql: 'SELECT id, title FROM modules ORDER BY position', nullable: true },
        { name: 'description', label: 'Descripción', type: 'textarea', rows: 2 },
        { name: 'time_limit_min', label: 'Tiempo límite (minutos)', type: 'number', default: 20, min: 1, max: 300, required: true, col: 6 },
        { name: 'pass_percent', label: 'Porcentaje de aprobación', type: 'number', default: 60, min: 1, max: 100, required: true, col: 6 },
        { name: 'questions_per_attempt', label: 'Preguntas por intento (0 = todas)', type: 'number', default: 0, min: 0, max: 200, col: 4 },
        { name: 'max_attempts', label: 'Intentos máximos (0 = ilimitados)', type: 'number', default: 0, min: 0, max: 50, col: 4 },
        { name: 'randomize', label: 'Preguntas aleatorias', type: 'select', options: { 1: 'Sí', 0: 'No' }, default: 1, col: 4 },
        { name: 'question_ids', label: 'Banco de preguntas', type: 'checks', virtual: true, help: 'Selecciona los ejercicios que formarán parte de la evaluación.' },
        statusField,
      ],
    },
    logros: {
      table: 'achievements',
      title: 'Insignias',
      singular: 'insignia',
      icon: 'bi-award',
      sql: 'SELECT a.*, (SELECT COUNT(*) FROM student_achievements s WHERE s.achievement_id=a.id) AS earned FROM achievements a',
      order: 'a.metric, a.threshold',
      search: ['a.name', 'a.code'],
      columns: [
        ['name', 'Insignia'],
        ['metric', 'Métrica'],
        ['threshold', 'Meta'],
        ['earned', 'Otorgadas'],
      ],
      fields: [
        { name: 'code', label: 'Código único', type: 'text', required: true, max: 40, pattern: '[a-z0-9-]+', help: 'Solo minúsculas, números y guiones.' },
        { name: 'name', label: 'Nombre', type: 'text', required: true, max: 80 },
        { name: 'description', label: 'Descripción', type: 'text', required: true, max: 250 },
        { name: 'icon', label: 'Icono (Bootstrap Icons)', type: 'text', default: 'bi-award', max: 40 },
        {
          name: 'metric', label: 'Métrica', type: 'select', required: true, col: 6,
          options: {
            lessons: 'Lecciones completadas', exercises: 'Ejercicios correctos', challenges: 'Retos superados',
            points: 'Puntos acumulados', modules: 'Módulos completados', assessments: 'Evaluaciones aprobadas',
            cases: 'Casos entregados',
          },
        },
        { name: 'threshold', label: 'Meta (cantidad necesaria)', type: 'number', default: 1, min: 1, required: true, col: 6 },
        statusField,
      ],
    },
  };
}
