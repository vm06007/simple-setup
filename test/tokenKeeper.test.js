const Token = artifacts.require("Token");
const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

// TODO:
const FOUR_ETH = web3.utils.toWei("91");
const TOKENS_OPENED = web3.utils.toWei("2");
const TOKENS_LOCKED = web3.utils.toWei("1");
const MIN_TIME_FRAME = 60000;


contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let token;
    let tokenKeeper;

    beforeEach(async () => {
        token = await Token.new();
        await token.transfer(token.address, FOUR_ETH);
        tokenKeeper = await TokenKeeper.new(owner, MIN_TIME_FRAME, token.address);
    });

    describe("Allocation Functionality", () => {

        it("should not allocate tokens with invalid time frame", async () => {
            const currentTime = await tokenKeeper.getNow();
            const timeFrame = MIN_TIME_FRAME / 2;
            
            let Error;
            try {
                await tokenKeeper.allocateTokens(
                    owner,
                    TOKENS_OPENED,
                    TOKENS_LOCKED,
                    timeFrame
                );
            } catch (error) {
                Error = error;
            }
            
            assert.notEqual(Error, undefined);
            assert.equal(Error.reason, "TokenKeeper: INVALID_TIME_FRAME");
        });

        it("should allocate correct values", async () => {
            const balance = await token.balanceOf(token.address);
            assert.equal(balance, FOUR_ETH);
 
            const timeFrame = MIN_TIME_FRAME * 2;

            await tokenKeeper.allocateTokens(
                owner,
                TOKENS_OPENED,
                TOKENS_LOCKED,
                timeFrame
            );

            const keeper = await tokenKeeper.keeperList.call(owner);
            const totalRequired = await tokenKeeper.totalRequired.call();

            assert.equal(totalRequired, Number(TOKENS_OPENED) + Number(TOKENS_LOCKED));

        });
    })

})

