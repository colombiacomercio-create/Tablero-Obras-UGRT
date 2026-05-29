const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=id';
const headers = {
  'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ',
  'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ'
};
fetch(url, { headers }).then(r => r.json()).then(data => {
  console.log('Total alertas_obra rows:', data.length);
});
