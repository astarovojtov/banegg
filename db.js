const postgres = require("postgres");

//ElephantSQL sign in with google as blew

const createUsers =
  'CREATE TABLE IF NOT EXISTS User ("userId" SERIAL PRIMARY KEY,"address" varchar(100) NOT NULL)';
const createCampaigns =
  'CREATE TABLE IF NOT EXISTS Campaigns ("id" SERIAL PRIMARY KEY, "url" text NOT NULL, "egg" varchar(100) NOT NULL, claim_amount smallint)';
const sql = postgres({
  host: "raja.db.elephantsql.com",
  database: "wktpcfcf",
  username: "wktpcfcf",
  password: "1FL5hTzgisTkZXCAnp_P0dMiQGXDn3KF",
});

function insertDummyUsers() {
  const users = [
    {
      address:
        "ban_164pii33414t9gkfs6cgqeiqakjojkxfjowtjiwkf6gf8wcfjf8wpn66z8kj",
    },
    {
      address:
        "ban_3gahaiusraz8qnotf3skqn3myo74o9f7hroqw8hhny51zkkx5ikbxsbat69c",
    },
    {
      address:
        "ban_3jo4o7j3z398xy4ywmjnaoqwfo1otnyrr4ubmd3pyshggf34hhcreuc6zkcw",
    },
  ];
  return sql`insert into users ${sql(users)}`;
}

function insertDummyCampaigns() {
  const campaigns = [
    {
      url: "https://banano.cc",
      egg: "dnfgoe",
      claim_amnt: 5,
      user_id: 1,
    },
    {
      url: "https://banhub.com",
      egg: "3fr3grg",
      claim_amnt: 1,
      user_id: 2,
    },
  ];
  return sql`insert into campaigns ${sql(campaigns)}`;
}
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
  console.log("db -> ");
  console.log(userId, token);
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
  } and egg = ${egg} and status = 'live'`;
}
function getCampaigns() {
  return sql`select * from campaigns`;
}
function getAllCampaigns() {
  return sql`select url from campaigns where claim_amnt > 0`;
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
  const camp = await sql`select * from campaigns where id = ${campaign.id}`;
  const mergedCamp = { ...camp[0], ...campaign };
  console.log(mergedCamp);
  return sql`update campaigns set ${sql(
    mergedCamp,
    "url",
    "egg",
    "claim_amnt",
    "claimed_by",
    "claimed_date",
    "status",
    "trxHash"
  )}
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
  getUserById: getUserById
};
