import { APP_AUTHOR, APP_NAME } from './config';
import { qs } from './dom';
import './styles.css';

const t = window.TrelloPowerUp.iframe({
  appName: APP_NAME,
  appAuthor: APP_AUTHOR,
});

t.render(() => {
  const params = new URLSearchParams(window.location.search);
  if (params.get('authorized') === '1') {
    t.closePopup();
    return t.sizeTo('#authorize-content');
  }

  // With admin key auth, authorization is handled server-side.
  // This page should never be shown in normal operation.
  const message = qs<HTMLParagraphElement>('#authorize-message');
  message.textContent = 'Le backend est configure. Aucune action requise.';

  return t.sizeTo('#authorize-content');
});
