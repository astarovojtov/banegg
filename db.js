const postgres = require("postgres");
const sql = postgres({
  host: "raja.db.elephantsql.com",
  database: "wktpcfcf",
  username: "wktpcfcf",
  password: process.env.DB_PASS,
});

function createUser(address) {
  const newUser = { address: address };
  return sql`insert into users ${sql(newUser)} returning *`;
}
function deleteUser(address) {
  return sql`delete * from users where address = ${address}`;
}
function getUser(address) {
  return sql`select * from users where address = ${address}`;
}
function getUserById(id) {
  return sql`select * from users where id = ${id}`;
}
function getUsers() {
  return sql`select * from users`;
}
function saveUserToken(userId, token) {
  return sql`update users set token = ${token} where id = ${userId}`;
}
function getCampaignById(id) {
  return sql`select * from campaigns where id = ${id}`;
}
function getCampaignsByUrl(url) {
  return sql`select * from campaigns where url LIKE ${"%" + url + "%"}`;
}

function getCampaignsByUrlEgg(url, egg) {
  return sql`select * from campaigns where url LIKE ${
    "%" + url + "%"
  } and egg = ${egg} and status = 'hidden'`;
}
function getCampaigns() {
  return sql`select * from campaigns`;
}
function getAllCampaigns() {
  return sql`select url from campaigns where status = 'hidden'`;
}
function countClaim(campaignId) {
  return sql`update campaigns set prizepool = prizepool - claim_amnt where id = ${campaignId} returning *`;
}
async function getUserCampaigns(address) {
  const user = await (await getUser(address)).pop();
  return await sql`select * from campaigns where user_id = ${user.id}`;
}
async function createCampaign(campaign) {
  return sql`insert into campaigns ${sql(campaign)} returning *`;
}
async function updateCampaign(campaign) {
  const campRemovedNulls = {};
  const tableNames = [];
  Object.keys(campaign).forEach( key => {
    if (campaign[key]) {
      campRemovedNulls[key] = campaign[key];
      tableNames.push(key);
    }
  })
  return sql`update campaigns set ${sql(campRemovedNulls)}  where id = ${campaign.id} returning *`
}

function updateCampaignStatusAndTrx(campaign) {
  return sql`update campaigns set status = ${campaign.status}, hide_trx = ${campaign.hide_trx}
        where id = ${campaign.id} returning *`;
}

async function editCampaign(campaign) {
  return sql`update campaigns set url = ${campaign.url}, egg = ${campaign.hash}
        where id = ${campaign.id} returning *`;
}
function updateCampaignStatus(campaign) {
  return sql`update campaigns set status = ${campaign.status}
        where id = ${campaign.id}`;
}
async function deleteCampaign(campaignId) {
  const camp = await sql`select * from campaigns where id = ${campaignId}`;
  return sql`delete from campaigns where id = ${campaignId}`;
}
function getFoundEggs(address) {
  return sql`select * from campaigns where claimed_by = ${address}`;
}
module.exports = {
  sql: sql,
  insertDummyUsers: insertDummyUsers,
  insertDummyCampaigns: insertDummyCampaigns,
  createUser: createUser,
  getUser: getUser,
  deleteUser: deleteUser,
  getUsers: getUsers,
  getCampaignsByUrl: getCampaignsByUrl,
  getCampaignsByUrlEgg: getCampaignsByUrlEgg,
  createCampaign: createCampaign,
  getCampaigns: getCampaigns,
  getCampaignById: getCampaignById,
  getUserCampaigns: getUserCampaigns,
  updateCampaign: updateCampaign,
  updateCampaignStatus: updateCampaignStatus,
  deleteCampaign: deleteCampaign,
  countClaim: countClaim,
  getAllCampaigns: getAllCampaigns,
  saveUserToken: saveUserToken,
  getFoundEggs: getFoundEggs,
  editCampaign: editCampaign,
  getUserById: getUserById,
  updateCampaignStatusAndTrx: updateCampaignStatusAndTrx,
};
