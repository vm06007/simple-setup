const { assert } = require("chai");

const Token = artifacts.require("Token");
const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

const _BN = web3.utils.BN;
const BN = (value) => {
   return new _BN(value);
}

const timeout = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const FOUR_ETH = web3.utils.toWei("4");
const TOKENS_OPENED = web3.utils.toWei("2");
const TOKENS_LOCKED = web3.utils.toWei("1");
const MIN_TIME_FRAME = 1;


contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let token;
    let tokenKeeper;

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

    describe("Balance Functionality", () => {

        it("it should return correct available balance", async () => {

            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const currentTime = await tokenKeeper.getNow();

            const keeper = await tokenKeeper.keeperList(alice);

            const timePassed = keeper.keeperFrom.sub(currentTime);

            const availableBalance = await tokenKeeper.availableBalance(alice);

            const expectedBalance = keeper.keeperRate
                .mul(timePassed)
                .add(keeper.keeperBalance)
                .sub(keeper.keeperPayouts);

            assert.equal(
                availableBalance.toString(),
                expectedBalance.toString()
            );

        });

        it("should return correct balance outside time frame", async () => {

            const timeFrame = MIN_TIME_FRAME;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            await advanceTimeAndBlock(timeFrame * 2);

            const keeper = await tokenKeeper.keeperList(alice);

            const availableBalance = await tokenKeeper.availableBalance(alice);

            const expectedBalance = keeper.keeperRate
                .mul(keeper.keeperTill.sub(keeper.keeperFrom))
                .add(keeper.keeperBalance)
                .sub(keeper.keeperPayouts);

            assert.equal(
                availableBalance.toString(),
                expectedBalance.toString()
            );
           
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

            const keeper = await tokenKeeper.keeperList(alice);

            const timeRemaining = keeper.keeperTill.sub(currentTime);

            const lockedBalance = await tokenKeeper.lockedBalance(alice);

            const expectedBalance = keeper.keeperRate.mul(timeRemaining);

            assert.equal(
                lockedBalance.toString(),
                expectedBalance.toString()
            );
        });

        it("it should return correct locked balance outside time frame", async () => {

            const timeFrame = MIN_TIME_FRAME;

            await tokenKeeper.allocateTokens(
                alice,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );
            
            await advanceTimeAndBlock(timeFrame * 2);

            const lockedBalance = await tokenKeeper.lockedBalance(alice);

            assert.equal(
                lockedBalance.toString(),
                "0"
            );
        });
    });

    describe("Allocation Functionality", () => {

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
                totalRequired.toString(),
                parseInt(TOKENS_OPENED) + parseInt(TOKENS_LOCKED)
            );

            const keeper = await tokenKeeper.keeperList(alice);

            assert.equal(
                keeper.keeperTill.toString(),
                parseInt(keeper.keeperFrom) + parseInt(timeFrame)
            );

            assert.equal(
                keeper.keeperRate.toString(),
                Math.floor(TOKENS_LOCKED / timeFrame)
            );

            assert.equal(
                keeper.keeperBalance.toString(),
                parseInt(TOKENS_LOCKED) % timeFrame + parseInt(TOKENS_OPENED)
            );
        });
        
        it("it should allocate tokens in bulk", async () => {

            const timeFrame = MIN_TIME_FRAME * 2;

            const recipientList = [owner];

            const tokensOpenedList = Array(recipientList.length).fill(TOKENS_OPENED);

            const tokensLockedList = Array(recipientList.length).fill(TOKENS_LOCKED);

            const timeFrameList = Array(recipientList.length).fill(timeFrame);

            const initialTotalRequired = await tokenKeeper.totalRequired();

            const addedTotalRequired = 
                (
                    parseInt(TOKENS_OPENED)
                    + parseInt(TOKENS_LOCKED)
                ) 
                * recipientList.length

            const expectedTotalRequired = initialTotalRequired.add(
                BN(addedTotalRequired.toString())
            );

            await tokenKeeper.allocateTokensBulk(
                recipientList,
                tokensOpenedList,
                tokensLockedList,
                timeFrameList
            );

            for(var i = 0; i < recipientList.length; i++) {
                const keeper = await tokenKeeper.keeperList(recipientList[i]);

                assert.equal(
                    keeper.keeperBalance.toString(),
                    parseInt(tokensLockedList[i]) 
                        % timeFrame 
                        + parseInt(tokensOpenedList[i])
                );
            }

            const updatedTotalRequired = await tokenKeeper.totalRequired();
            
            assert.equal(
                updatedTotalRequired.toString(),
                expectedTotalRequired.toString()
            );
        });

        it("should not allocate tokens with invalid time frame", async () => {

            const timeFrame = MIN_TIME_FRAME / 2;

            const result = await catchRevert(
                tokenKeeper.allocateTokens(
                    alice,
                    TOKENS_OPENED,
                    TOKENS_LOCKED,
                    timeFrame
                ),
                "TokenKeeper: INVALID_TIME_FRAME"
            );
        });
    })

    describe("Scrape Functionality", () => {

        it("it should scrape tokens from owner and update keeper payout", async () => {

            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const keeper = await tokenKeeper.keeperList(owner);

            // scrape owner tokens
            const values = await Promise.all([
                tokenKeeper.getNow(),
                tokenKeeper.scrapeMyTokens()
             ]);

            const timestamp = values[0];

            const timePassed = timestamp.sub(keeper.keeperFrom);

            const availableBalance = keeper.keeperRate
                .mul(timePassed)
                .add(keeper.keeperBalance)
                .sub(keeper.keeperPayouts);

            // expected values
            const expectedPayout = keeper.keeperPayouts.add(availableBalance);

            // test updated values
            const updatedKeeper = await tokenKeeper.keeperList(owner);

            assert.equal(
                updatedKeeper.keeperPayouts.toString(), 
                expectedPayout.toString()
            );
        });

        it("it should scrape tokens from owner and update owner token balance", async () => {

            const timeFrame = MIN_TIME_FRAME * 2;

            const tokenBalance = await token.balanceOf(owner);

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const keeper = await tokenKeeper.keeperList(owner);

            // scrape owner tokens
            const values = await Promise.all([
                tokenKeeper.getNow(),
                tokenKeeper.scrapeMyTokens()
             ]);

            const timestamp = values[0];

            const timePassed = timestamp.sub(keeper.keeperFrom);

            const availableBalance = keeper.keeperRate
                .mul(timePassed)
                .add(keeper.keeperBalance)
                .sub(keeper.keeperPayouts);

            const expectedBalance = tokenBalance.add(availableBalance);

            // test updated values
            const updatedTokenBalance = await token.balanceOf(owner);

            assert.equal(
                updatedTokenBalance.toString(),
                expectedBalance.toString()
            );

        });

        it("it should scrape tokens from owner and update token keeper total required amount", async () => {

            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            // store values before scraping
            const keeper = await tokenKeeper.keeperList(owner);
            const totalRequired = await tokenKeeper.totalRequired();

            // scrape owner tokens
            const values = await Promise.all([
                tokenKeeper.getNow(),
                tokenKeeper.scrapeMyTokens()
            ]);

            const timestamp = values[0];

            const timePassed = timestamp.sub(keeper.keeperFrom);

            const availableBalance = keeper.keeperRate
                .mul(timePassed)
                .add(keeper.keeperBalance)
                .sub(keeper.keeperPayouts);

            const expectedTotalRequired = totalRequired.sub(availableBalance);

            // test updated values
            const updatedTotalRequired = await tokenKeeper.totalRequired();

            assert.equal(
                updatedTotalRequired.toString(),
                expectedTotalRequired.toString()
            );

        });
    });

    describe("Deployment Functionality", () => {

        it("should not deploy for invalid address", async () => {

            await catchRevert(
                TokenKeeper.new(
                    ZERO_ADDRESS, 
                    MIN_TIME_FRAME, 
                    token.address
                ),
                "TokenKeeper: INVALID_KEEPER"
            );
        });
        
        it("should not deploy for invalid time frame", async () => {

            await catchRevert(
                TokenKeeper.new(
                    owner, 
                    0, 
                    token.address
                ),
                "TokenKeeper: INVALID_TIMEFRAME"
            );
        });

        it("should not deploy for invalid token", async () => {

            await catchRevert(
                TokenKeeper.new(
                    owner, 
                    MIN_TIME_FRAME, 
                    ZERO_ADDRESS
                ),
                "TokenKeeper: INVALID_TOKEN"
            );
        });
        
        it("should renounce ownership", async () => {

            await tokenKeeper.renounceOwnership();
            
            const keeper = await tokenKeeper.tokenKeeper();
            
            assert.equal(keeper.toString(), ZERO_ADDRESS);

        });        
    })

})
