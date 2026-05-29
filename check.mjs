const url = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/alertas_obra?select=*&limit=1';
const headers = {
  'apikey': 'sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ',
  'Authorization': 'Bearer sb_publishable_Gh_zFuXXr0Xru4SsATc4sA_VBMVUXJJ'
};
fetch(url, { headers }).then(r => r.json()).then(data => {
  console.log('alertas_obra keys:', Object.keys(data[0]));
  console.log('alertas_obra sample:', data[0]);
});

const url2 = 'https://nuvxndlhfnrtpufsnviz.supabase.co/rest/v1/frentes_obra?select=*&limit=1';
fetch(url2, { headers }).then(r => r.json()).then(data => {
  console.log('frentes_obra keys:', Object.keys(data[0]));
  console.log('frentes_obra sample:', data[0]);
});
