// scripts/removeSnippetSize.js

const mongoose = require('mongoose');
require('dotenv').config(); // if you're using .env for DB config

// Replace with your actual MongoDB connection string if not using .env
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://Group:SoundByte@work.isfmbkb.mongodb.net/SoundByte?retryWrites=true&w=majority&appName=Work';

const Snippet = require('../models/Snippet');

async function removeSnippetSizeField() {
    try {
        await mongoose.connect(MONGO_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        const result = await Snippet.updateMany({}, { $unset: { snippetSize: 1 } });

        console.log(`✅ Operation complete.`);
        console.log(`🔢 Matched: ${result.matchedCount}`);
        console.log(`🛠️ Modified: ${result.modifiedCount}`);


        console.log(`✅ Removed 'snippetSize' from ${result.modifiedCount} snippet(s).`);

        await mongoose.disconnect();
    } catch (err) {
        console.error('❌ Failed to remove snippetSize:', err);
        process.exit(1);
    }
}

removeSnippetSizeField();
