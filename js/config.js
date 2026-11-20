/* ENESMA Shop configuration.
   ACCESS_MODE: 'open' lets anyone browse and order (current, so the shop can be reviewed).
   Set to 'members' later to limit browsing and ordering to ENESMA agents, admins, and preferred partners.
   APPS_SCRIPT_URL: the Apps Script web app URL ending in /exec. Leave empty until deployed. */
window.ENESMA_SHOP = {
  ACCESS_MODE: 'open',
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzHWD_fqsaWAtIu0LKxA4niaK1EqHCaUj3r_5RqZMcfm999bHxoCrpCGV1RWHjZ8D71/exec',
  HUB_API_URL: 'https://script.google.com/macros/s/AKfycbzYtmzYv74D0yi0sVy-_JaLDYlNLSU795sqhREsqbGYYU1BEDR5KDAB7Du9Mm0Gp4ba/exec',
  HUB_LOGIN_URL: 'https://agent.enesmarealty.com/',
  SITE_NAME: 'ENESMA Shop',
  ASSET: '20261120n'
};
