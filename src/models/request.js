const { DataTypes } = require("sequelize")
const sequelize = require('../db/db');

const Request = sequelize.define('Request', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
    },
    res_deadline: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    comp_deadline: {
        type: DataTypes.DATEONLY,
        allowNull: false,
    },
    description: {
        type: DataTypes.TEXT,
    }
}, {
    freezeTableName: true,
    timestamps: false
})

module.exports = Request