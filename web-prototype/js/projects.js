import { api } from './api.js';
import { openModal, closeModal, toast } from './ui.js';
import { escapeHtml } from './utils.js';

export async function chooseIssueProject() {
  let projects;
  try { projects = await api.listIssueProjects(); }
  catch (err) { toast(err.message, true); return null; }
  if (!projects.length) { toast('Нет доступных текущих проектов. Проверьте права доступа к проектам в ИСУ.', true); return null; }
  return new Promise(resolve => {
    openModal('Для какого проекта берём приборы?', `<form id="issueProjectForm" class="form-grid">
      <label>Проект<select id="issueProjectSelect" required><option value="">Выберите проект</option>
      ${projects.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}</select></label>
      <p>Выдача изменит реальное наличие приборов.</p>
      <div class="modal-actions"><button type="button" id="issueProjectCancel">Отмена</button><button class="primary" type="submit">Продолжить</button></div></form>`);
    const form = document.getElementById('issueProjectForm');
    form.addEventListener('keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeModal(); resolve(null); }
    }, true);
    const select = form.querySelector('select');
    form.querySelector('#issueProjectCancel').onclick = () => { closeModal(); resolve(null); };
    form.onsubmit = e => { e.preventDefault(); const project=projects.find(p => String(p.id)===select.value); if(project) { closeModal();resolve(project); } };
    // Закрытие крестиком, фоном или Escape также отменяет выбор.
    document.getElementById('modal').addEventListener('close', () => resolve(null), { once:true });
  });
}
