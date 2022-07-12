const { assert } = require("chai");

const Token = artifacts.require("Token");
const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

// TODO:
const FOUR_ETH = web3.utils.toWei("4");
const TOKENS_OPENED = web3.utils.toWei("2");
const TOKENS_LOCKED = web3.utils.toWei("1");
const MIN_TIME_FRAME = 60000;


contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let token;
    let tokenKeeper;

    // allocations to alice

    beforeEach(async () => {

        token = await Token.new();

        tokenKeeper = await TokenKeeper.new(
            owner, 
            MIN_TIME_FRAME, 
            token.address
        );

        await token.transfer(
            tokenKeeper.address, 
            FOUR_ETH
        );

    });

    describe("Allocation Functionality", () => {

        it("should not allocate tokens with invalid time frame", async () => {

            const timeFrame = MIN_TIME_FRAME / 2;

            await catchRevert(
                tokenKeeper.allocateTokens(
                    alice,
                    TOKENS_OPENED,
                    TOKENS_LOCKED,
                    timeFrame
                ),
                "TokenKeeper: INVALID_TIME_FRAME"
            );
        });

        it("should allocate correct values", async () => {
            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const totalRequired = await tokenKeeper.totalRequired();

            assert.equal(
                parseInt(totalRequired),
                parseInt(TOKENS_OPENED) + parseInt(TOKENS_LOCKED)
            );

            const keeper = await tokenKeeper.keeperList.call(alice);

            assert.equal(
                parseInt(keeper.keeperTill),
                parseInt(keeper.keeperFrom) + parseInt(timeFrame)
            );

            assert.equal(
                parseInt(keeper.keeperRate),
                Math.floor(TOKENS_LOCKED / timeFrame)
            );

            assert.equal(
                parseInt(keeper.keeperBalance),
                parseInt(TOKENS_LOCKED) % timeFrame + parseInt(TOKENS_OPENED)
            );
        });

        it("it should return correct available balance", async () => {
            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const currentTime = await tokenKeeper.getNow();

            const keeper = await tokenKeeper.keeperList.call(alice);

            const timePassed = keeper.keeperFrom - currentTime;

            const availableBalance = await tokenKeeper.availableBalance(alice);

            const expectedBalance = keeper.keeperRate 
                * timePassed
                + keeper.keeperBalance 
                - keeper.keeperPayouts;

            assert.equal(
                parseInt(availableBalance),
                parseInt(expectedBalance)
            )

        });

        it("it should return correct locked balance", async () => {
            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const currentTime = await tokenKeeper.getNow();

            const keeper = await tokenKeeper.keeperList.call(alice);

            const timeRemaining = keeper.keeperTill - currentTime;

            const lockedBalance = await tokenKeeper.lockedBalance(alice);

            const expectedBalance = keeper.keeperRate  * timeRemaining;

            assert.equal(
                parseInt(lockedBalance),
                parseInt(expectedBalance)
            )
        });

        it("it should scrape tokens from owner", async () => {
            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            // store values before scraping
            const tokenBalance = await token.balanceOf(owner);

            const keeper = await tokenKeeper.keeperList.call(owner);

            const availableBalance = await tokenKeeper.availableBalance(owner);

            const totalRequired = await tokenKeeper.totalRequired(); 

            // expected values
            const expectedPayout = parseInt(keeper.keeperPayouts) 
                + parseInt(availableBalance);
            
            const expectedTotalRequired = parseInt(totalRequired) - parseInt(availableBalance);

            const expectedBalance = tokenBalance + availableBalance;

            // scrape owner tokens
            await tokenKeeper.scrapeMyTokens()

            // test updated values
            const updatedKeeper = await tokenKeeper.keeperList.call(owner);

            assert.equal(
                parseInt(updatedKeeper.keeperPayouts), 
                expectedPayout
            );

            const updatedTotalRequired = await tokenKeeper.totalRequired();

            assert.equal(
                parseInt(updatedTotalRequired),
                parseInt(expectedTotalRequired)
            );

            const updatedTokenBalance = await token.balanceOf(owner);
            assert.equal(
                parseInt(updatedTokenBalance),
                parseInt(expectedBalance)
            );

        });
    })
})
