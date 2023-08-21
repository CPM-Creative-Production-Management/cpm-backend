const express = require('express')
const router = express.Router()
const passport = require('passport')
const { decodeToken, getCommentsRecursive } = require('../utils/helper')
const { Agency, Request, ReqAgency, Company, RequestTask, Estimation, Task, TaskTag, Tag, Employee, User, Comment, Review } = require('../models/associations')
const { Op } = require('sequelize')

const requestGetter = async (accepted, finalized, associatedId) => {
    const reply = await Agency.findByPk(associatedId, {
        include: [
            {
                model: ReqAgency,
                where: {
                    accepted: accepted,
                    finalized: finalized,
                },
                include: [{
                    model: Request,
                    include: RequestTask
                }, Company, Estimation],
                // attributes: {
                //     exclude: ['id', 'accepted', 'finalized', 'ReqAgencyId']
                // }
            }
    ],
    })
    return reply
}
// get a list of all the pending requests
router.get('/pending', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const agencies = await requestGetter(false, false, associatedId)
        if (agencies === null) {
            res.json([])
        } else {res.json(agencies.ReqAgencies)}
    } catch (err) {
        console.error(err)
    }
})

// get a list of waiting requests
router.get('/accepted', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const agencies = await requestGetter(true, false, associatedId)
        console.log(agencies)
        if (agencies === null) {
            res.json([])
        } else {
            agencies.ReqAgencies.map(reqAgency => {
                if (reqAgency.Estimation) {
                    reqAgency.dataValues.estimationExists = true
                } else {
                    reqAgency.dataValues.estimationExists = false
                }
            })
            res.json(agencies.ReqAgencies)
        }
    } catch (err) {
        console.error(err)
    }
})

// get a list of accepted requests
router.get('/finalized', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const agencies = await requestGetter(true, true, associatedId)
        if (agencies === null) {
            res.json([])
        } else {
            agencies.ReqAgencies.map(reqAgency => {
                if (reqAgency.Estimation) {
                    reqAgency.dataValues.estimationExists = true
                } else {
                    reqAgency.dataValues.estimationExists = false
                }
            })
            res.json(agencies.ReqAgencies)
        }
    } catch (err) {
        console.error(err)
    }
})


// get a particular request
router.get('/:id(\\d+)', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const id = req.params.id
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    if (decodedToken.type === 1) {
        try {
            const request = await Request.findByPk(id, {
                include: RequestTask
            })
            return res.json(request)
        } catch (err) {
            console.error(err)
            return res.json(err)
        }
    }
    try {
        const request = await Request.findByPk(id, {
            include: RequestTask
        })
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: id,
                AgencyId: associatedId
            }, include: {
                model: Estimation,
                include: [{
                    model: Task,
                    include: [TaskTag, Employee]
                }, {
                    model: Tag
                }]
            }
        })
        const company = await Company.findByPk(reqAgency.CompanyId)
        request.dataValues.company = company
        request.dataValues.ReqAgency = reqAgency
        if (reqAgency.Estimation) {
            request.dataValues.ReqAgency.dataValues.Estimation.dataValues.tasks = request.dataValues.ReqAgency.dataValues.Estimation.dataValues.Tasks
            request.dataValues.ReqAgency.dataValues.Estimation.dataValues.tasks.map(task => {
                task.dataValues.tags = task.dataValues.TaskTags
                delete task.dataValues.TaskTags
            })
            request.dataValues.ReqAgency.dataValues.Estimation.dataValues.tags = request.dataValues.ReqAgency.dataValues.Estimation.dataValues.Tags
            delete request.dataValues.ReqAgency.dataValues.Estimation.dataValues.Tags
            delete request.dataValues.ReqAgency.dataValues.Estimation.dataValues.Tasks

            let totalCost = 0
            request.dataValues.ReqAgency.dataValues.Estimation.dataValues.tasks.map(task => {
                totalCost += task.cost
            })
            request.dataValues.ReqAgency.dataValues.Estimation.dataValues.extraCost = request.dataValues.ReqAgency.dataValues.Estimation.dataValues.cost - totalCost
            request.dataValues.estimationExists = true
        } else {
            request.dataValues.estimationExists = false
        }

        // delete request.dataValues.ReqAgency.dataValues.Estimation.dataValues.tasks.dataValues.TaskTags
        // delete request.dataValues.ReqAgency.dataValues.Estimation.dataValues.Tasks
        console.log(request)
        res.json(request)
    } catch (err) {
        console.error(err)
    }
})

// accept a particular request
router.post('/:id/accept', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const id = req.params.id
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    console.log(associatedId)
    try {
        const request = await Request.findByPk(id, {
            include: {
                model: ReqAgency,
                where: {
                    AgencyId: associatedId,
                    accepted: false
                }
            }
        })
        if (!request) {
            res.status(404).json({message: "request not found"})
            return
        }
        if (request.ReqAgencies[0] !== null) {
            request.ReqAgencies[0].accepted = true
            request.ReqAgencies[0].save()
            res.json(request)
        }
        // res.json(request)
        else {
            res.json({ message: "already accepted"})
        }
    } catch (err) {
        console.error(err)
        res.json(err)
    }
})

// reject a particular request
router.post('/:id/reject', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const id = req.params.id
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const request = await Request.findByPk(id, {
            include: {
                model: ReqAgency,
                where: {
                    AgencyId: associatedId
                }
            }
        })
        if (request !== null) {
            if (request.ReqAgencies[0] !== null) {
                const pk = request.ReqAgencies[0].id
                await ReqAgency.destroy({
                    where: {
                        id: pk
                    }
                })
                res.json({message: "request removed successfully"})
            }
        }
        else {
            res.json({message: "request unavailable for rejection"})
        }
    } catch (err) {
        console.error(err)
    }
})

// post a broadcast request
router.post('/', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    const company = await Company.findByPk(associatedId)
    // create an object without req.body.tasks
    const { tasks, ...request } = req.body
    try {
        const newRequest = await Request.create(request)
        // add the tasks to the request
        for (const task of tasks) {
            const newTask = await RequestTask.create(task)
            await newRequest.addRequestTask(newTask)
        }
        const agencies = await Agency.findAll()
        await Promise.all(agencies.map(async agency => {
            await agency.addRequest(newRequest)
            const reqagency = await ReqAgency.findOne({
                where: {
                    AgencyId: agency.id,
                    RequestId: newRequest.id
                }
            })
            await reqagency.setCompany(company)
        }))

        res.json(newRequest)
    } catch (err) {
        console.error(err)
        res.status(500).json(err)
    }
})

// post a reqeuest to a particular agency
router.post('/agency/:id', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const agencyId = req.params.id
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    const company = await Company.findByPk(associatedId)
    const { tasks, ...request } = req.body
    try {
        const newRequest = await Request.create(request)
        // add the tasks to the request
        for (const task of tasks) {
            const newTask = await RequestTask.create(task)
            await newRequest.addRequestTask(newTask)
        }
        const agency = await Agency.findByPk(agencyId)
        await agency.addRequest(newRequest)
        const reqagency = await ReqAgency.findOne({
            where: {
                AgencyId: agency.id,
                RequestId: newRequest.id
            }
        })
        await reqagency.setCompany(company)
        res.json(newRequest)
    } catch (err) {
        console.error(err)
        res.status(500).json(err)
    }
})

// get all requests of a company
router.get('/company', passport.authenticate('jwt', {session: false}), async (req, res) => {
    // will be called by a user
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const requests = await Request.findAll({
            include: {
                model: ReqAgency,
                where: {
                    CompanyId: associatedId
                },
                include: Estimation
            }    
        })

        requests.map(req => {
            let responses = 0
            let finalized = false
            req.ReqAgencies.map(reqAgency => {
                if (reqAgency.accepted) {
                    responses++
                }
                if (reqAgency.finalized && !finalized) {
                    req.dataValues.finalized = true
                    req.dataValues.estimation = reqAgency.Estimation
                    req.dataValues.agencyId = reqAgency.AgencyId
                    finalized = true
                }
            })
            if (!finalized) {
                req.dataValues.finalized = false
            }
            req.dataValues.responses = responses
            delete req.dataValues.ReqAgencies
        })

        res.json(requests)
    } catch (err) {
        console.error(err)
        res.status(500).json(err)
    }
})

// for a particular request of a company
// get all the agencies that have accepted the request
router.get('/company/:id(\\d+)/responses', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const id = req.params.id
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const request = await Request.findByPk(id, {
            include: {
                model: ReqAgency,
                where: {
                    CompanyId: associatedId,
                    accepted: true
                },
                include: Agency
            }
        })
        // async for loop
        for (const reqAgency of request.ReqAgencies) {
            const estimation = await reqAgency.getEstimation({
                include: Task,
                attributes: ['cost', 'id']
            })
            if (estimation) {
                reqAgency.dataValues.cost = estimation.cost
                reqAgency.dataValues.estimationId = estimation.id
            }
        }
        res.json(request)
    } catch (err) {
        console.error(err)
        res.status(500).json(err)
    }
})

// for a particular request, for a particular agency
// post a comment
router.post('/:rid(\\d+)/agency/:aid(\\d+)/comment', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const requestId = req.params.rid
    const agencyId = req.params.aid
    const decodedToken = decodeToken(req)
    const body = req.body.body
    try {
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: requestId,
                AgencyId: agencyId
            }
        })

        if (reqAgency === null) {
            res.status(404).json({message: "request not found"})
            return
        }

        const user = await User.findOne({
            where: {
                email: decodedToken.email
            }
        })

        const comment = await Comment.create({
            body: body
        })

        await comment.setUser(user)
        await comment.setReqAgency(reqAgency)

        res.status(200).json({message: "comment posted successfully"})
        
    } catch (err) {
        console.log(err)
        res.status(500).json({message: "server error"})
    }
})

// for a particular request, for a particular agency
// get all comments
router.get('/:rid(\\d+)/agency/:aid(\\d+)/comment', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const requestId = req.params.rid
    const agencyId = req.params.aid
    try {
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: requestId,
                AgencyId: agencyId
            }
        })

        if (reqAgency === null) {
            res.status(404).json({message: "request not found"})
            return
        }

        const comments = await Comment.findAll({
            where: {
                ReqAgencyId: reqAgency.id,
                level: 0
            },
            include: {
                model: User,
                attributes: { exclude: ['password', 'username', 'id']},
            }
        })

        for (let i = 0; i < comments.length; i++) {
            const comment = comments[i]
            await getCommentsRecursive(comment)
        }

        res.status(200).json(comments)

    } catch (err) {
        console.log(err)
        res.status(500).json({message: "server error"})
    }
})

// post a review
router.post('/:rid(\\d+)/agency/:aid(\\d+)/review', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const requestId = req.params.rid
    const agencyId = req.params.aid

    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    const review = req.body

    try {
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: requestId,
                AgencyId: agencyId
            }
        })
        if (reqAgency === null) {
            res.status(404).json({message: "request not found"})
            return
        }
        if (reqAgency.CompanyId !== associatedId) {
            res.status(401).json({message: "unauthorized"})
            return
        }

        const newReview = await Review.create(review)
        await newReview.setReqAgency(reqAgency)
        res.status(200).json({message: "review posted successfully"})
    } catch (err) {
        console.log(err)
        res.status(500).json({message: "server error"})
    }
})

// get all reviews for a particular request and a particular agency
router.get('/:rid(\\d+)/agency/:aid(\\d+)/review', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const requestId = req.params.rid
    const agencyId = req.params.aid
    
    try {
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: requestId,
                AgencyId: agencyId
            }
        })
        if (reqAgency === null) {
            res.status(404).json({message: "request not found"})
            return
        }
        const reviews = await Review.findAll({
            where: {
                ReqAgencyId: reqAgency.id
            },
            include: {
                model: User,
                attributes: { exclude: ['password', 'id']},
            }
        })

        res.status(200).json(reviews)

    } catch (err) {
        console.log(err)
        res.status(500).json({message: "server error"})
    }
})

// finalize a request
router.post('/:rid(\\d+)/agency/:aid(\\d+)/finalize', passport.authenticate('jwt', {session: false}), async (req, res) => {
    const requestId = req.params.rid
    const agencyId = req.params.aid
    const decodedToken = decodeToken(req)
    const associatedId = decodedToken.associatedId;
    try {
        const reqAgency = await ReqAgency.findOne({
            where: {
                RequestId: requestId,
                AgencyId: agencyId
            }
        })
        if (reqAgency === null) {
            res.status(404).json({message: "request not found"})
            return
        }
        if (reqAgency.CompanyId !== associatedId) {
            res.status(401).json({message: "unauthorized"})
            return
        }

        if (reqAgency.finalized) {
            res.status(400).json({message: "request already finalized"})
            return
        }

        reqAgency.finalized = true

        // find other reqAgencies for the same request
        const otherReqAgencies = await ReqAgency.findAll({
            where: {
                RequestId: requestId,
                AgencyId: {
                    [Op.ne]: agencyId
                }
            }
        })

        // delete other reqAgencies
        for (const otherReqAgency of otherReqAgencies) {
            await otherReqAgency.destroy()
        }

        await reqAgency.save()
        res.status(200).json({message: "request finalized successfully"})

    } catch (err) {
        console.log(err)
        res.status(500).json({message: "server error"})
    }
})


module.exports = router