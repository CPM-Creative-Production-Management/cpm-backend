const { DataTypes } = require("sequelize")
const sequelize = require('../db/db');

// Choice (Full / EMI----> N=3/6/12 months)
// Principal, P = Total Budget fixed in the Estimation
// Rate R = fixed by Agency in the Estimation
// P x R x (1+R)^N / [((1+R)^N)-1] 

const PaymentHistory = sequelize.define('Payment_History', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    amount: {              //amount paid in this installment. Total paid amount = sum of all 'amount' of all 'successful' installments.
        type: DataTypes.FLOAT,
        allowNull: false
    },
    transaction_id: {               //unique transaction id will be different for each installment
        type: DataTypes.TEXT,
        allowNull: false,
        unique: true
    },
    status: {                       //pending, success, fail
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    freezeTableName: true,
})

module.exports = PaymentHistory