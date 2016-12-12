import { Condition, ICondition } from './condition'
import { DBEntity } from '../../db-entity'

import { Query, QueryParamResolver, IQueryParam } from '../../query'
import MateriaError from '../../../error'

/*
Conditions manage a list of condition (associated with `operand`)
Conditions structure:
[
	{
		name: string,
		operator: string,
		value: string,
		operand: string (optional|default:AND)
		priorityLevel: integer (optional|default:0)
	},
	{
		...
	}
]
*/


const SequelizeOperatorsKeys = {
	'=': '$eq',
	'!=': '$ne',
	'>': '$gt',
	'>=': '$gte',
	'<': '$lt',
	'<=': '$lte',
	'LIKE': '$like',
	'NOT LIKE': '$notLike',
	'ILIKE': '$iLike',
	'NOT ILIKE': '$notILike'
}

export type IConditions = ICondition[]

export class Conditions {
	conditions: Array<Condition>

	constructor(conditions:Array<ICondition>, private entity: DBEntity) {
		this.conditions = []

		if (conditions) {
			for (let condition of conditions) {
				if (condition.entity && ! entity.app.entities.get(condition.entity)) {
					throw new MateriaError(`Could not find entity "${condition.entity}" in condition`)
				}
				this.conditions.push(new Condition(condition, entity && entity.name))
			}
		}
	}

	toSequelize(params: Array<any>, entityName: string): Object {
		params = params || []

		let $and = [], $or = []
		for (let condition of this.conditions) {
			if (condition.name && condition.operator && condition.entity == entityName) {
				let cond
				if (condition.operator == 'IS NULL') {
					cond = { $eq: null }
				} else if (condition.operator == 'IS NOT NULL') {
					cond = { $not: null }
				} else {
					let resolvedParam = QueryParamResolver.resolve(condition, params)
					let opkey = SequelizeOperatorsKeys[condition.operator.toUpperCase()]
					cond = {}
					cond[opkey] = resolvedParam
				}
				cond = { [condition.name]: cond }

				if (condition.operand && condition.operand.toUpperCase() == 'OR') {
					$or.push(cond)
				} else {
					$and.push(cond)
				}
			}
		}

		if ($or.length) {
			if ($and.length) {
				if ($and.length == 1) {
					$or.push($and[0])
				} else {
					$or.push({ $and: $and })
				}
			}
			if ($or.length == 1) {
				return $or[0]
			} else {
				return { $or: $or }
			}
		} else if ($and.length) {
			if ($and.length == 1) {
				return $and[0]
			} else {
				return { $and: $and }
			}
		}
	}

	constructConditions(entities, params) {
		for (let entity of entities) {
			for (let condition of this.conditions) {
				if (condition && condition.entity == entity.model.name) {
					entity.where = this.toSequelize(params, condition.entity)
				}
				if (entity.include) {
					this.constructConditions(entity.include, params)
				}
			}
		}
	}

	discoverParams():Array<IQueryParam> {
		let params = [] as IQueryParam[]
		this.conditions.forEach(condition => {
			if (condition.valueIsParam()) {
				let field;
				if (condition.entity != this.entity.name) {
					field = this.entity.app.entities.get(condition.entity).getField(condition.name)
				}
				else {
					field = this.entity.getField(condition.name)
				}

				let paramName = condition.name
				if (condition.value.length > 1) {
					paramName = condition.value.substr(1)
				}
				params.push({
					name: paramName,
					reference: {
						entity: condition.entity,
						field: condition.name
					},
					type: field.type,
					component: field.component,
					required: true
				})
			}
		})
		return params
	}

	toJson() {
		let res = []
		this.conditions.forEach((condition) => {
			res.push(condition.toJson())
		})
		return res
	}
}