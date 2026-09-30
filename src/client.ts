import { APP_AUTHOR, APP_NAME, DONE_COLUMNS_NAMES, ICON_URL } from './config';
import { resolveLinkedCards } from './backendClient';
import { computeProgress, getRelationLabel, summarizeBadges } from './linkedCards';
import { getLinks } from './trelloStorage';
import './styles.css';

function openManager(t: { popup: (options: Record<string, unknown>) => Promise<void> }): Promise<void> {
  return t.popup({
    title: 'Linked Cards',
    url: './popup.html',
    height: 520,
  });
}

function openAuthorize(t: { popup: (options: Record<string, unknown>) => Promise<void> }): Promise<void> {
  return t.popup({
    title: 'Autoriser Linked Cards',
    url: './authorize.html',
    height: 220,
  });
}

window.TrelloPowerUp.initialize(
  {
    'authorization-status': async (_t: any) => {
      return { authorized: true };
    },
    'show-authorization': (t: any) => openAuthorize(t),
    'card-buttons': async (t: any) => [
      {
        icon: ICON_URL,
        text: 'Linked Cards',
        callback: (context: any) => openManager(context),
      },
    ],
    'card-back-section': (t: any) => ({
      title: 'Linked Cards',
      icon: ICON_URL,
      content: {
        type: 'iframe',
        url: t.signUrl('./section.html'),
        height: 360,
      },
      action: {
        text: 'Gérer',
        callback: (t: any) => openManager(t),
      },
    }),
    'card-badges': async (t: any) => {
      const links = await getLinks(t).catch(() => []);
      const summary = summarizeBadges(links);
      if (summary.total === 0) return [];

      return [
        {
          text: summary.blockers > 0 ? `${summary.blockers} bloque` : `${summary.total} lien${summary.total > 1 ? 's' : ''}`,
          icon: ICON_URL,
          color: summary.blockers > 0 ? 'red' : 'blue',
        },
      ];
    },
    'card-detail-badges': async (t: any) => {
      const links = await getLinks(t).catch(() => []);
      const summary = summarizeBadges(links);
      if (summary.total === 0) return [];

      const blockingText =
        summary.blockers > 0
          ? `${summary.blockers} carte${summary.blockers > 1 ? 's' : ''} bloquante${summary.blockers > 1 ? 's' : ''}`
          : links
              .slice(0, 2)
              .map((link) => getRelationLabel(link.relation))
              .join(', ');

      const badges: Array<Record<string, unknown>> = [
        {
          title: 'Linked Cards',
          text: `${summary.total} lien${summary.total > 1 ? 's' : ''} - ${blockingText}`,
          color: summary.blockers > 0 ? 'red' : 'blue',
          callback: (context: any) => openManager(context),
        },
      ];

      const childLinks = links.filter((link) => link.relation === 'parentOf');
      if (childLinks.length > 0) {
        try {
          const progress = computeProgress(await resolveLinkedCards(childLinks), DONE_COLUMNS_NAMES);
          if (progress) {
            badges.push({
              title: 'Avancement',
              text: `${progress.percent} % (${progress.done}/${progress.total})`,
              color: progress.percent === 100 ? 'green' : 'blue',
            });
          }
        } catch {
          // Backend indisponible : on n'affiche simplement pas l'avancement.
        }
      }

      return badges;
    },
  },
  {
    appName: APP_NAME,
    appAuthor: APP_AUTHOR,
  },
);
