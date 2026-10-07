
// Проекты для выдачи: ровно те, к папкам которых пользователь имеет доступ в ИСУ.
export function canReadProject(rules, folder) {
  if (!folder || !folder.startsWith('/Дела/')) return false;
  const rule = rules.filter(r => folder === r.path || folder.startsWith(r.path.replace(/\/+$/, '') + '/'))
    .sort((a,b) => b.path.length - a.path.length)[0];
  return rule?.access === 'read' || rule?.access === 'write';
}
export async function listIssueProjects(client, user) {
  const { rows } = await client.query("SELECT id, name, folder_path FROM cases WHERE deleted_at IS NULL AND stage <> 'done' AND NOT is_cancelled ORDER BY lower(name)");
  if (user.role === 'admin') return rows;
  const { rows: access } = await client.query('SELECT can_cases FROM fm_permissions WHERE user_id=$1', [user.id]);
  if (!access[0]?.can_cases) return [];
  const { rows: rules } = await client.query('SELECT path, access FROM fm_folder_permissions WHERE user_id=$1', [user.id]);
  return rows.filter(row => canReadProject(rules, row.folder_path));
}
export async function findIssueProject(client, user, id) {
  if (id === undefined || id === null || id === '') return null;
  if (!/^\d+$/.test(String(id))) { const err=new Error('Некорректный проект'); err.status=400; throw err; }
  const projects = await listIssueProjects(client, user);
  const project = projects.find(p => String(p.id) === String(id));
  if (!project) { const err=new Error('Проект недоступен, удалён или находится в архиве'); err.status=403; throw err; }
  // Не даём удалить/архивировать проект между проверкой и записью выдачи.
  const { rows } = await client.query("SELECT id, name FROM cases WHERE id=$1 AND deleted_at IS NULL AND stage <> 'done' AND NOT is_cancelled FOR SHARE", [project.id]);
  if (!rows.length) { const err=new Error('Проект уже удалён или переведён в архив'); err.status=409; throw err; }
  return rows[0];
}
