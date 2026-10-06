const { MongoClient } = require("mongodb");
(async () => {
  const c = await MongoClient.connect(process.env.MONGO_URL || "mongodb://127.0.0.1:27017");
  const db = c.db(process.env.DB_NAME || "kickball");
  if (!(await db.collection("news").countDocuments()))
    await db.collection("news").insertMany([
      { date: "2026-10-05", title: "Welcome to the Flagstaff Kickball League!", body: "We're starting a co-ed, all-skill-levels kickball league right here in Flagstaff. Sign up today to reserve your spot." },
    ]);
  if (!(await db.collection("events").countDocuments()))
    await db.collection("events").insertMany([
      { date: "2026-10-17", time: "10:00 AM", title: "Open Sign-Up Meetup", type: "social", location: "Thorpe Park, Flagstaff", details: "Meet the organizers and learn the rules." },
      { date: "2026-11-01", time: "10:00 AM", title: "Season Opener", type: "game", location: "Thorpe Park Field 1", details: "Week 1 games begin!" },
    ]);
  console.log("Seeded."); await c.close();
})();
