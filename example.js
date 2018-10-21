// Copyright (c) 2018, Fexra, The TurtleCoin Developers
//
// Please see the included LICENSE file for more information.
'use strict'

// load .env file
require('dotenv').config()


// Iniate TRTLServices, load token from .env
const TRTLServices = require('ts-api-js')

const TS = new TRTLServices({
  token: process.env.TOKEN,
  timeout: 2000 // request timeout
})


// Connect to the database. You can use knex with:
// postgres, sqlite, mysql, oracle, mssql
// Refer to knex.js.org for docs

const knex = require('knex')({
  client: 'sqlite3',
  connection: {
    filename: './db.sqlite'
  }
})


// Create 'addresses' table if it does not exist
knex.schema.hasTable('addresses').then(function(exists) {
  if (!exists) {
    return knex.schema.createTable('addresses', function(table) {
      table.increments()
      table.unique('address')
      table.string('address')
      table.decimal('balance', 24, 2).defaultTo(0)
      table.decimal('locked', 24, 2).defaultTo(0)
      table.integer('blockIndex').defaultTo(0)
      table.integer('scanIndex').defaultTo(0)
      table.datetime('created').defaultTo(knex.fn.now())
  })
}
})

// Create 'transactions' table if it does not exist
knex.schema.hasTable('transactions').then(function(exists) {
  if (!exists) {
    return knex.schema.createTable('transactions', function(table) {
      table.increments()
      table.string('address')
      table.decimal('amount', 24, 2)
      table.decimal('fee', 24, 2)
      table.decimal('sfee', 24, 2).defaultTo(0)
      table.string('transactionHash')
      table.string('blockHash')
      table.string('paymentId').defaultTo(null)
      table.string('extra')
      table.integer('blockIndex')
      table.integer('timestamp')
      table.integer('confirms').defaultTo(0)
      table.datetime('created').defaultTo(knex.fn.now())
    })
  }
})

async function app() {

  const newAddress = await TS.createAddress()

  await knex('addresses')
  .insert({
    address: newAddress.address,
    blockIndex: newAddress.blockIndex,
    scanIndex: newAddress.blockIndex
  })
  .limit(1)

  const storedAddresses = await knex('addresses')
  .select()
  
  storedAddresses.forEach(async function(address) {

    var getStatus = await TS.getStatus()
    var knownBlockCount = getStatus[1].blockIndex
    var heightDiff = knownBlockCount - address.scanIndex
    var newIndex = address.scanIndex + 100

    if (address.scanIndex >= knownBlockCount) {
      heightDiff = knownBlockCount - address.scanIndex
    }

    if(heightDiff < 100) {
      newIndex = knownBlockCount 
    }

    var scanAddress = await TS.scanAddress(address.address, address.scanIndex)

    console.log( )
    if(scanAddress.length <= 0) {
      console.log('[' + address.address + '] no transactions found between height: ' + address.scanIndex + ' - ' + newIndex)
    }
    else {
      scanAddress.forEach(async function(tx) {

        await knex('transactions')
        .insert({
          address: tx.address,
          amount: tx.amount,
          fee: tx.fee,
          blockIndex: tx.blockIndex,
          transactionHash: tx.transactionHash,
          paymentId: tx.paymentId,
          extra: tx.extra,
          timestamp: tx.timestamp,
          confirms: tx.confirms
        })
        .limit(1)

        console.log('[' + address.address + '] stored ' + scanAddress.length + ' transactions found between height: ' + address.scanIndex + ' - ' + newIndex)
      })
    }
  })

  // load transactions

  const tx = await knex('transactions')
  .select()

  console.log(tx)
}


app()