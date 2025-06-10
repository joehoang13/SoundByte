const express = require('express')
const router = express.Router()
const userController = require('../controllers/usersController')

router.get('/', userController.getUserByEmail)
router.get('/dummy', userController.getUserDummy)

module.exports = router
