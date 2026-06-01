const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=*&limit=5';
const headers = { 'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ', 'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ' };
fetch(url, { headers })
  .then(res => res.json())
  .then(data => console.log(JSON.stringify(data[0], null, 2)));
