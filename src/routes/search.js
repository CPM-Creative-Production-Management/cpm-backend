const express = require('express')
const router = express.Router()
const passport = require('passport')
const { decodeToken } = require('../utils/helper')
const { Request, Company, Agency, ReqAgency, Tag, Estimation, User } = require('../models/associations')
const { Op } = require('sequelize');
const frontendURL = process.env.FRONTEND_URL

// search by any keyword for a company, agency, request name, estimation title or tag
router.get('/', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const decodedToken = decodeToken(req)
        const associatedId = decodedToken.associatedId

        var keyword = "";
        const estimationConditions = {};
        const agencyConditions = {};
        if (req.query.keyword) {
            keyword = req.query.keyword;
            estimationConditions.title = {
                [Op.iLike]: `%${keyword}%`
            };
            agencyConditions.name = {
                [Op.iLike]: `%${keyword}%`
            };
        }
        console.log("keyword --------> ", keyword)

        var filter = [];
        if (req.query.filter) {
            filter = req.query.filter;
        }
        console.log("filter --------> ", filter)

        var searchTags = [];
        if (req.query.tag) {
            if (Array.isArray(req.query.tag)) {
                searchTags = req.query.tag.map(num => parseInt(num, 10));
            } else {
                searchTags = [parseInt(req.query.tag, 10)];
            }
        }
        console.log("searchTags --------> ", searchTags)

        var result = {
            user: [],
            employee: [],
            company: [],
            agency: [],
            request: [],
            estimation: []
        }

        const thisUser = await User.findOne({
            where:
            {
                associatedId: associatedId
            },
            attributes: {
                exclude: ['password']
            }
        });

        if (searchTags.length > 0) {
            // if tags are specified, search for only agencies and estimations with those tags

            const agency = await Agency.findAll({
                where: agencyConditions,
                include: [
                    {
                        model: Tag,
                        where: {
                            id: {
                                [Op.in]: searchTags
                            }
                        },
                    }
                ]
            });
            var agencyJson = agency.map(o => o.toJSON());
            for (var i = 0; i < agencyJson.length; i++) {
                agencyJson[i].url = frontendURL + '/agency/' + agencyJson[i].id
            }
            result.agency = agencyJson

            const estimation = await Estimation.findAll({
                where: estimationConditions,
                include: [
                    {
                        model: ReqAgency,
                        attributes: ['AgencyId', 'CompanyId', 'RequestId'],
                        where: {
                            [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                        },
                        include: [
                            {
                                model: Agency
                            },
                            {
                                model: Company
                            },
                            {
                                model: Request,
                            }
                        ],
                    },
                    {
                        model: Tag,
                        where: {
                            id: {
                                [Op.in]: searchTags
                            }
                        }
                    }
                ],
            });
            var estimationJson = estimation.map(o => o.toJSON());
            for (var i = 0; i < estimationJson.length; i++) {
                estimationJson[i].url = frontendURL + '/request/' + estimationJson[i].ReqAgency.RequestId + '/agency/' + estimationJson[i].ReqAgency.AgencyId + '/estimation'
            }
            console.log(estimationJson.length)
            result.estimation = estimationJson
        }
        else {
            // if tags are not specified, search for all entities

            if (filter.length === 0) {

                // if no filter, send all results
                if (thisUser.type === 2) {
                    //find which agency this user belongs to
                    const thisUserAgency = await Agency.findByPk(associatedId)

                    // find all employees of the agency whose name this keyword matches with
                    const employee = await thisUserAgency.getEmployees({
                        where: {
                            name: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        }
                    });
                    var employeeJson = employee.map(o => o.toJSON());
                    for (var i = 0; i < employeeJson.length; i++) {
                        delete employeeJson[i].password
                        employeeJson[i].url = frontendURL + '/profile/' + employeeJson[i].id
                    }
                    result.employee = employeeJson
                }

                const user = await User.findAll({
                    where: {
                        name: {
                            [Op.iLike]: `%${keyword}%`
                        }
                    }
                });
                var userJson = user.map(o => o.toJSON());
                for (var i = 0; i < userJson.length; i++) {
                    delete userJson[i].password
                    userJson[i].url = frontendURL + '/profile/' + userJson[i].id
                }
                result.user = userJson

                const agency = await Agency.findAll({
                    where: {
                        name: {
                            [Op.iLike]: `%${keyword}%`
                        }
                    }
                });
                var agencyJson = agency.map(o => o.toJSON());
                for (var i = 0; i < agencyJson.length; i++) {
                    agencyJson[i].url = frontendURL + '/agency/' + agencyJson[i].id
                }
                result.agency = agencyJson

                const request = await Request.findAll({
                    where: {
                        name: {
                            [Op.iLike]: `%${keyword}%`
                        }
                    },
                    include: [
                        {
                            model: ReqAgency,
                            where: {
                                [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                            },
                        },
                    ],
                });
                result.request = request

                const estimation = await Estimation.findAll({
                    where: estimationConditions,
                    include: [
                        {
                            model: ReqAgency,
                            attributes: ['AgencyId', 'CompanyId', 'RequestId'],
                            where: {
                                [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                            },
                            include: [
                                {
                                    model: Agency
                                },
                                {
                                    model: Company
                                },
                                {
                                    model: Request,
                                }
                            ],
                        }
                    ],
                });
                var estimationJson = estimation.map(o => o.toJSON());
                for (var i = 0; i < estimationJson.length; i++) {
                    estimationJson[i].url = frontendURL + '/request/' + estimationJson[i].ReqAgency.RequestId + '/agency/' + estimationJson[i].ReqAgency.AgencyId + '/estimation'
                }
                console.log(estimationJson)
                result.estimation = estimationJson
            }
            else {
                // send only filtered results

                if (filter.includes('employee') && thisUser.type === 2) {
                    //find which agency this user belongs to
                    const thisUserAgency = await Agency.findByPk(associatedId)

                    // find all employees of the agency whose name this keyword matches with
                    const employee = await thisUserAgency.getEmployees({
                        where: {
                            name: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        }
                    });
                    var employeeJson = employee.map(o => o.toJSON());
                    for (var i = 0; i < employeeJson.length; i++) {
                        delete employeeJson[i].password
                        employeeJson[i].url = frontendURL + '/profile/' + employeeJson[i].id
                    }
                    result.employee = employeeJson
                }


                if (filter.includes('user')) {
                    const user = await User.findAll({
                        where: {
                            name: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        }
                    });
                    var userJson = user.map(o => o.toJSON());
                    for (var i = 0; i < userJson.length; i++) {
                        delete userJson[i].password
                        userJson[i].url = frontendURL + '/profile/' + userJson[i].id
                    }
                    result.user = userJson
                }

                if (filter.includes('agency')) {
                    const agency = await Agency.findAll({
                        where: {
                            name: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        }
                    });
                    var agencyJson = agency.map(o => o.toJSON());
                    for (var i = 0; i < agencyJson.length; i++) {
                        agencyJson[i].url = frontendURL + '/agency/' + agencyJson[i].id
                    }
                    result.agency = agencyJson
                }
                if (filter.includes('request')) {
                    const request = await Request.findAll({
                        where: {
                            name: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        },
                        include: [
                            {
                                model: ReqAgency,
                                where: {
                                    [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                                },
                            },
                        ],
                    });
                    result.request = request
                }
                if (filter.includes('estimation')) {
                    const estimation = await Estimation.findAll({
                        where: {
                            title: {
                                [Op.iLike]: `%${keyword}%`
                            }
                        },
                        include: [
                            {
                                model: ReqAgency,
                                attributes: ['AgencyId', 'CompanyId', 'RequestId'],
                                where: {
                                    [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                                },
                                include: [
                                    {
                                        model: Agency
                                    },
                                    {
                                        model: Company
                                    },
                                    {
                                        model: Request,
                                    }
                                ],
                            }
                        ],
                    });
                    var estimationJson = estimation.map(o => o.toJSON());
                    for (var i = 0; i < estimationJson.length; i++) {
                        estimationJson[i].url = frontendURL + '/request/' + estimationJson[i].ReqAgency.RequestId + '/agency/' + estimationJson[i].ReqAgency.AgencyId + '/estimation'
                    }
                    console.log(estimationJson)
                    result.estimation = estimationJson
                }
            }
        }
        res.json(result)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})


// search for a company by its name or any substring of its name
router.get('/company/:keyword', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const decodedToken = decodeToken(req)
        const { keyword } = req.params;
        const company = await Company.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${keyword}%`
                }
            }
        })
        res.json(company)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

// search for an agency by its name or any substring of its name
router.get('/agency/:keyword', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const decodedToken = decodeToken(req)
        const { keyword } = req.params;
        const agency = await Agency.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${keyword}%`
                }
            }
        })
        res.json(agency)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

// search for a request by its title or any substring of its title
router.get('/request/:keyword', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const decodedToken = decodeToken(req)
        const associatedId = decodedToken.associatedId;
        const { keyword } = req.params;

        const request = await Request.findAll({
            where: {
                name: {
                    [Op.iLike]: `%${keyword}%`
                }
            },
            include: [
                {
                    model: ReqAgency,
                    where: {
                        [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                    },
                },
            ],
        })
        res.json(request)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

// search for an estimation by its tag
router.get('/tag/:keyword', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const decodedToken = decodeToken(req)
        const associatedId = decodedToken.associatedId
        const { keyword } = req.params;

        const tag = await Tag.findAll({
            where: {
                tag: {
                    [Op.iLike]: `%${keyword}%`
                }
            },
            include: [
                {
                    model: Estimation,
                    include: [
                        {
                            model: ReqAgency,
                            attributes: ['AgencyId', 'CompanyId'],
                            where: {
                                [Op.or]: [{ AgencyId: associatedId }, { CompanyId: associatedId }]
                            },
                            include: [
                                {
                                    model: Agency
                                },
                                {
                                    model: Company
                                },
                            ],
                        },
                    ],
                },
            ],
        })
        res.json(tag)
    } catch (error) {
        res.status(500).json({ error: 'Internal server error' });
    }
})

module.exports = router
