const { connectToDatabase } = require('../utils/dbConnection');
const mongoose = require('mongoose');

module.exports = async (req, res) => {
    try {
        await connectToDatabase();
        const topo = mongoose.connection.client.topology?.description;
        res.status(200).json({
            ok: true,
            readyState: mongoose.connection.readyState, // 1 = connected
            type: topo?.type,
            setName: topo?.setName,
            servers: Array.from(topo?.servers?.keys?.() ?? []),
        });
    } catch (e) {
        res.status(500).json({ ok: false, message: e.message });
    }
};
