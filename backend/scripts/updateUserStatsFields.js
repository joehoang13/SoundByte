const mongoose = require('mongoose');
const User = require('../models/Users');

async function addMissingStats() {
  try {
    await mongoose.connect(
      'mongodb+srv://Group:SoundByte@work.isfmbkb.mongodb.net/SoundByte?retryWrites=true&w=majority&appName=Work',
      {
        // These options are optional for mongoose 6+
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );

    const users = await User.find({});
    let updated = 0;

    for (const user of users) {
      let modified = false;

      if (user.highestScore === undefined) {
        user.highestScore = 0;
        modified = true;
      }

      if (user.totalSnippetsGuessed === undefined) {
        user.totalSnippetsGuessed = 0;
        modified = true;
      }

      if (modified) {
        await user.save();
        updated++;
      }
    }

    mongoose.disconnect();
  } catch (err) {
    console.error('❌ Error updating users:', err);
    process.exit(1);
  }
}

addMissingStats();
