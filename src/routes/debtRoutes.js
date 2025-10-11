const express = require('express');
const {createNewDebt,getAllDebt} = require('../controller/debtController');


const router = express.Router();

router.post("/", protect, createNewDebt);
router.get("/",protect, getAllDebt);


module.exports = router;