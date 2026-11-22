import { getContentCached, getPublishedCached } from '../data/api.js';
import { mergeContent } from '../data/defaults.js';
import { esc, observeReveal, setMeta, $ } from '../lib/util.js';
import { config } from '../config.js';
import { icon } from '../lib/icons.js';
import { projectCard, skeletonCards } from '../lib/cards.js';
import { trackPageview } from '../lib/track.js';

export async function projectsPage(view) {
  view.innerHTML = `
    <section class="wrap detail" style="padding-top:1.25rem">
      <a class="back-link" href="/">${icon('arrowLeft')}<span>Back home</span></a>
      <header class="section-head" style="margin-bottom:1.25rem">
        <span class="eyebrow">Archive</span>
        <h1>All projects</h1>
        <p id="allProjectsCount">Loading published projects...</p>
      </header>
      <div style="margin-bottom:1.4rem">
        <input class="input" id="projectSearch" type="search" placeholder="Search projects by title or keyword..." style="max-width:340px" />
      </div>
      <div class="all-projects-wrap" style="margin-top:0;padding-top:0;border-top:0">
        <div class="project-grid" id="allProjectsGrid">${skeletonCards(3)}</div>
      </div>
    </section>`;

  const [content, projects] = await Promise.all([
    getContentCached().catch(() => mergeContent({})),
    getPublishedCached().catch(() => []),
  ]);

  setMeta({
    title: `Projects — ${content.site.name}`,
    description: content.home.projectsSubtitle,
    url: `${config.siteUrl}/projects`,
  });
  trackPageview('/projects');

  const grid = $('#allProjectsGrid', view);
  const countEl = $('#allProjectsCount', view);
  const searchEl = $('#projectSearch', view);
  let stopReveal = () => {};

  function renderList(q = '') {
    const term = q.trim().toLowerCase();
    const list = term
      ? projects.filter(
          (p) =>
            p.title.toLowerCase().includes(term) ||
            (p.shortDescription || '').toLowerCase().includes(term)
        )
      : projects;

    countEl.textContent = projects.length
      ? `${list.length} of ${projects.length} published project(s)`
      : 'No projects published yet.';

    grid.innerHTML = list.length
      ? list.map(projectCard).join('')
      : `<div class="empty-state"><strong>No matching projects.</strong><p>${term ? 'Try another search keyword.' : 'Check back soon.'}</p></div>`;

    stopReveal();
    stopReveal = observeReveal(view);
  }

  renderList();
  searchEl?.addEventListener('input', (e) => renderList(e.target.value));

  return () => stopReveal();
}