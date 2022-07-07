const TokenKeeper = artifacts.require("TokenKeeper");
const catchRevert = require("./exceptionsHelpers.js").catchRevert;

require("./utils");

// TODO:
const FOUR_ETH = web3.utils.toWei("3");
const FIVE_ETH = web3.utils.toWei("5");
const MIN_TIME_FRAME = null;
const INVALID_TIME_FRAME = null;

contract("TokenKeeper", ([owner, alice, bob, random]) => {

    let tokenKeeper;

    beforeEach(async () => {
        // TODO: check params
        tokenKeeper = await TokenKeeper.new(owner, MIN_TIME_FRAME, alice);
    });

    describe("Allocation Functionality", () => {
        it("should have correct token keeper", async () => {
            const name = await tokenKeeper.name();
            assert.equal(
                name,
                "TokenKeeper"
            );
        });

        it("should not allocate tokens with invalid time frame", () => {
            // TODO: check params
            await tokenKeeper.allocateTokens(
                owner,
                FOUR_ETH,
                FIVE_ETH,
                INVALID_TIME_FRAME
            )

            const balance = await tokenKeeper.availableBalance(owner);
        })
    })

})

