import { call, getContext, select, take } from 'redux-saga/effects'
import { expectSaga } from 'redux-saga-test-plan'
import * as matchers from 'redux-saga-test-plan/matchers'
import { ChainId, Entity, EntityType, Item, Network, Rarity, Trade, TradeAssetType, TradeType as DCLTradeType } from '@dcl/schemas'
import { CreditsService } from 'decentraland-dapps/dist/lib/credits'
import { pollCreditsBalanceRequest } from 'decentraland-dapps/dist/modules/credits/actions'
import { getCredits } from 'decentraland-dapps/dist/modules/credits/selectors'
import { CreditsResponse } from 'decentraland-dapps/dist/modules/credits/types'
import { setPurchase } from 'decentraland-dapps/dist/modules/gateway/actions'
import { TradeType } from 'decentraland-dapps/dist/modules/gateway/transak/types'
import { ManaPurchase, NFTPurchase, PurchaseStatus } from 'decentraland-dapps/dist/modules/gateway/types'
import { closeModal, openModal } from 'decentraland-dapps/dist/modules/modal/actions'
import { TradeService } from 'decentraland-dapps/dist/modules/trades/TradeService'
import { Wallet } from 'decentraland-dapps/dist/modules/wallet/types'
import { sendTransaction } from 'decentraland-dapps/dist/modules/wallet/utils'
import { NetworkGatewayType } from 'decentraland-ui'
import { fetchSmartWearableRequiredPermissionsRequest } from '../asset/actions'
import { buyAssetWithCard, BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY } from '../asset/utils'
import {
  getIsCreditsEnabled,
  getIsMarketplaceServerEnabled,
  getIsOffchainPublicItemOrdersEnabled,
  getIsOffchainPublicNFTOrdersEnabled
} from '../features/selectors'
import { waitForFeatureFlagsToBeLoaded } from '../features/utils'
import { locations } from '../routing/locations'
import { View } from '../ui/types'
import { CatalogAPI } from '../vendor/decentraland/catalog/api'
import { ItemAPI } from '../vendor/decentraland/item/api'
import { PeerAPI } from '../vendor/decentraland/peer/api'
import { getWallet } from '../wallet/selectors'
import { waitForWalletConnectionAndIdentityIfConnecting } from '../wallet/utils'
import {
  buyItemRequest,
  buyItemFailure,
  buyItemSuccess,
  fetchItemsRequest,
  fetchItemsSuccess,
  fetchItemsFailure,
  fetchItemSuccess,
  fetchItemRequest,
  fetchItemFailure,
  fetchTrendingItemsSuccess,
  fetchTrendingItemsFailure,
  fetchTrendingItemsRequest,
  buyItemWithCardRequest,
  buyItemWithCardFailure,
  buyItemWithCardSuccess,
  FETCH_ITEM_FAILURE,
  fetchCollectionItemsRequest,
  fetchCollectionItemsSuccess,
  fetchCollectionItemsFailure,
  FETCH_ITEMS_CANCELLED_ERROR_MESSAGE
} from './actions'
import { CANCEL_FETCH_ITEMS, itemSaga } from './sagas'
import { getData as getItems } from './selectors'
import { ItemBrowseOptions } from './types'
import { getItem } from './utils'

const item = {
  itemId: 'anItemId',
  price: '324234',
  chainId: ChainId.MATIC_MAINNET,
  contractAddress: '0x32Be343B94f860124dC4fEe278FDCBD38C102D88'
} as Item

const wallet = {
  address: '0x32be343b94f860124dc4fee278fdcbd38c102d88',
  chainId: ChainId.MATIC_MAINNET
}

const txHash = '0x9fc518261399c1bd236997706347f8b117a061cef5518073b1c3eefd5efbff84'

const anError = new Error('An error occured')

const itemBrowseOptions: ItemBrowseOptions = {
  view: View.MARKET,
  page: 0,
  filters: {}
}

const manaPurchase: ManaPurchase = {
  address: 'anAddress',
  id: 'anId',
  network: Network.ETHEREUM,
  timestamp: 1671028355396,
  status: PurchaseStatus.PENDING,
  gateway: NetworkGatewayType.TRANSAK,
  txHash,
  paymentMethod: 'paymentMethod',
  amount: 10
}

const nftPurchase: NFTPurchase = {
  ...manaPurchase,
  nft: {
    contractAddress: 'contractAddress',
    itemId: 'anId',
    tokenId: undefined,
    tradeType: TradeType.PRIMARY,
    cryptoAmount: 10
  }
}

const entity: Entity = {
  id: 'id',
  content: [],
  pointers: [],
  timestamp: 123123,
  type: EntityType.WEARABLE,
  version: 'v1'
}

const mockCredits: CreditsResponse = {
  totalCredits: 1000,
  credits: [
    {
      id: '1',
      amount: '1000',
      availableAmount: '1000',
      contract: '0x123',
      expiresAt: '1000',
      season: 1,
      signature: '123',
      timestamp: '1000',
      userAddress: '0x123'
    }
  ]
}

const getIdentity = () => undefined

describe('when handling the buy items request action', () => {
  describe("when there's no wallet loaded in the state", () => {
    it('should dispatch an action signaling the failure of the action handling', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getWallet), null],
          [select(getIsCreditsEnabled), false]
        ])
        .put(buyItemFailure('A defined wallet is required to buy an item'))
        .dispatch(buyItemRequest(item))
        .run({ silenceTimeout: true })
    })
  })

  describe('when sending the meta transaction fails', () => {
    it('should dispatch an action signaling the failure of the action handling', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getWallet), wallet],
          [select(getIsCreditsEnabled), false],
          [matchers.call.fn(sendTransaction), Promise.reject(anError)]
        ])
        .put(buyItemFailure(anError.message))
        .dispatch(buyItemRequest(item))
        .run({ silenceTimeout: true })
    })
  })

  describe('when the meta transaction is sent succesfully', () => {
    it('should send a meta transaction to the collection store contract living in the chain provided by the item and dispatch the success action', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getWallet), wallet],
          [select(getIsCreditsEnabled), false],
          [matchers.call.fn(sendTransaction), Promise.resolve(txHash)]
        ])
        .put(buyItemSuccess(wallet.chainId, txHash, item))
        .dispatch(buyItemRequest(item))
        .run({ silenceTimeout: true })
    })
  })

  describe('when the item has an order from a trade', () => {
    let itemWithTrade: Item
    let trade: Trade

    beforeEach(() => {
      itemWithTrade = {
        ...item,
        tradeId: 'some-trade-id'
      }

      trade = {
        id: itemWithTrade.tradeId!,
        createdAt: Date.now(),
        signer: wallet.address,
        signature: '0x324234',
        type: DCLTradeType.PUBLIC_ITEM_ORDER,
        network: Network.ETHEREUM,
        chainId: ChainId.ETHEREUM_SEPOLIA,
        checks: {
          expiration: Date.now() + 100000000000,
          effective: Date.now(),
          uses: 1,
          salt: '0x',
          allowedRoot: '0x',
          contractSignatureIndex: 0,
          externalChecks: [],
          signerSignatureIndex: 0
        },
        sent: [
          {
            assetType: TradeAssetType.COLLECTION_ITEM,
            contractAddress: '0x1234',
            itemId: '1',
            extra: ''
          }
        ],
        received: [
          {
            assetType: TradeAssetType.ERC20,
            contractAddress: '0x123',
            amount: '2',
            extra: '',
            beneficiary: wallet.address
          }
        ]
      }
    })

    describe('and the user is trying to buy an item using credits', () => {
      describe('and credits are enabled', () => {
        let credits: CreditsResponse
        describe('and the user has enough credits', () => {
          beforeEach(() => {
            credits = {
              ...mockCredits,
              totalCredits: Number(itemWithTrade.price) + 1000
            }
          })
          it('should send a use credits trade tx and poll the credits balance', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), credits],
                [matchers.call.fn(TradeService.prototype.fetchTrade), trade],
                [matchers.call.fn(CreditsService.prototype.useCreditsMarketplace), Promise.resolve(txHash)]
              ])
              .put(buyItemSuccess(wallet.chainId, txHash, itemWithTrade))
              .put(pollCreditsBalanceRequest(wallet.address, BigInt(credits.totalCredits) - BigInt(itemWithTrade.price)))
              .dispatch(buyItemRequest(itemWithTrade, true))
              .run({ silenceTimeout: true })
          })
        })
        describe('and the user has some credits but not enough', () => {
          beforeEach(() => {
            credits = {
              ...mockCredits,
              totalCredits: Number(itemWithTrade.price) - 1000
            }
          })
          it('should send a use credits trade tx and poll the credits balance', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), credits],
                [matchers.call.fn(TradeService.prototype.fetchTrade), trade],
                [matchers.call.fn(CreditsService.prototype.useCreditsMarketplace), Promise.resolve(txHash)]
              ])
              .put(buyItemSuccess(wallet.chainId, txHash, itemWithTrade))
              .put(pollCreditsBalanceRequest(wallet.address, BigInt(0))) // should have used all credits
              .dispatch(buyItemRequest(itemWithTrade, true))
              .run({ silenceTimeout: true })
          })
        })

        describe('and the user does not have enough credits', () => {
          it('should throw an error', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), undefined]
              ])
              .put(buyItemFailure('No credits available'))
              .dispatch(buyItemRequest(itemWithTrade, true))
              .run({ silenceTimeout: true })
          })
        })
      })
    })

    describe('and credits are not enabled', () => {
      it('should send an accept trade tx', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [select(getWallet), wallet],
            [select(getIsCreditsEnabled), false],
            [matchers.call.fn(TradeService.prototype.fetchTrade), trade],
            [matchers.call.fn(TradeService.prototype.accept), Promise.resolve(txHash)]
          ])
          .put(buyItemSuccess(wallet.chainId, txHash, itemWithTrade))
          .dispatch(buyItemRequest(itemWithTrade))
          .run({ silenceTimeout: true })
      })
    })
  })

  describe('when the item does not have a trade and instead is a CollectionStore mint', () => {
    let itemWithNoTrade: Item

    beforeEach(() => {
      itemWithNoTrade = {
        ...item,
        tradeId: undefined,
        isOnSale: true,
        price: '1000000000000000000'
      }
    })

    describe('and the user is trying to buy an item using credits', () => {
      describe('and credits are enabled', () => {
        let credits: CreditsResponse
        describe('and the user has enough credits', () => {
          beforeEach(() => {
            credits = {
              ...mockCredits,
              totalCredits: Number(itemWithNoTrade.price) + 1000
            }
          })
          it('should send a use credits through the CollectionStore tx and poll the credits balance', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), credits],
                [matchers.call.fn(CreditsService.prototype.useCreditsCollectionStore), Promise.resolve(txHash)]
              ])
              .put(buyItemSuccess(wallet.chainId, txHash, itemWithNoTrade))
              .put(pollCreditsBalanceRequest(wallet.address, BigInt(credits.totalCredits) - BigInt(itemWithNoTrade.price)))
              .dispatch(buyItemRequest(itemWithNoTrade, true))
              .run({ silenceTimeout: true })
          })
        })
        describe('and the user has some credits but not enough', () => {
          beforeEach(() => {
            credits = {
              ...mockCredits,
              totalCredits: Number(itemWithNoTrade.price) - 1000
            }
          })
          it('should send a use credits trade tx and poll the credits balance', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), credits],
                [matchers.call.fn(CreditsService.prototype.useCreditsCollectionStore), Promise.resolve(txHash)]
              ])
              .put(buyItemSuccess(wallet.chainId, txHash, itemWithNoTrade))
              .put(pollCreditsBalanceRequest(wallet.address, BigInt(0))) // should have used all credits
              .dispatch(buyItemRequest(itemWithNoTrade, true))
              .run({ silenceTimeout: true })
          })
        })

        describe('and the user does not have enough credits', () => {
          it('should throw an error', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getWallet), wallet],
                [select(getIsCreditsEnabled), true],
                [select(getCredits, wallet.address), undefined]
              ])
              .put(buyItemFailure('No credits available'))
              .dispatch(buyItemRequest(itemWithNoTrade, true))
              .run({ silenceTimeout: true })
          })
        })
      })
    })

    describe('and credits are not enabled', () => {
      it('should send a CollectionStore buy tx', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [select(getWallet), wallet],
            [select(getIsCreditsEnabled), false],
            [matchers.call.fn(sendTransaction), Promise.resolve(txHash)] // CollectionStore buy call
          ])
          .put(buyItemSuccess(wallet.chainId, txHash, itemWithNoTrade))
          .dispatch(buyItemRequest(itemWithNoTrade))
          .run({ silenceTimeout: true })
      })
    })
  })
})

describe('when handling the buy items with card action', () => {
  beforeEach(() => {
    jest.spyOn(Object.getPrototypeOf(localStorage), 'setItem')
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe('when the explanation modal has already been shown', () => {
    it('should open Transak widget', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([[call([localStorage, 'getItem'], BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY), null]])
        .put(openModal('BuyWithCardExplanationModal', { asset: item, order: undefined }))
        .dispatch(buyItemWithCardRequest(item))
        .dispatch(closeModal('BuyWithCardExplanationModal'))
        .run({ silenceTimeout: true })
        .then(() => {
          expect(localStorage.setItem).not.toHaveBeenCalled()
        })
    })
  })

  describe('when the explanation modal is shown and the user closes it', () => {
    it('should not set the item in the local storage to show the modal again later', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([[call([localStorage, 'getItem'], BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY), null]])
        .put(openModal('BuyWithCardExplanationModal', { asset: item, order: undefined }))
        .dispatch(buyItemWithCardRequest(item))
        .dispatch(closeModal('BuyWithCardExplanationModal'))
        .run({ silenceTimeout: true })
        .then(() => {
          expect(localStorage.setItem).not.toHaveBeenCalled()
        })
    })
  })

  describe('when opening Transak Widget fails', () => {
    it('should dispatch an action signaling the failure of the action handling', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([[call(buyAssetWithCard, item, undefined, false), Promise.reject(anError)]])
        .put(buyItemWithCardFailure(anError.message))
        .dispatch(buyItemWithCardRequest(item))
        .run({ silenceTimeout: true })
    })
  })

  describe('when Transak widget is opened succesfully', () => {
    it('should dispatch the success action', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([[call(buyAssetWithCard, item, undefined, false), Promise.resolve()]])
        .dispatch(buyItemWithCardRequest(item, false))
        .run({ silenceTimeout: true })
        .then(({ effects }) => {
          expect(effects.put).toBeUndefined()
        })
    })
  })
})

describe('when handling the set purchase action', () => {
  describe('when it is a MANA purchase', () => {
    it('should not put any new action', () => {
      return expectSaga(itemSaga, getIdentity)
        .dispatch(setPurchase(manaPurchase))
        .run({ silenceTimeout: true })
        .then(({ effects }) => {
          expect(effects.put).toBeUndefined()
        })
    })
  })

  describe('when it is an NFT purchase', () => {
    describe('when it is a secondary market purchase', () => {
      it('should not put any new action', () => {
        return expectSaga(itemSaga, getIdentity)
          .dispatch(
            setPurchase({
              ...nftPurchase,
              nft: {
                ...nftPurchase.nft,
                tokenId: nftPurchase.nft.itemId,
                tradeType: TradeType.SECONDARY,
                itemId: undefined
              }
            })
          )
          .run({ silenceTimeout: true })
          .then(({ effects }) => {
            expect(effects.put).toBeUndefined()
          })
      })
    })

    describe('when the purchase is incomplete', () => {
      it('should not put any new action', () => {
        return expectSaga(itemSaga, getIdentity)
          .dispatch(setPurchase(nftPurchase))
          .run({ silenceTimeout: true })
          .then(({ effects }) => {
            expect(effects.put).toBeUndefined()
          })
      })
    })

    describe('when it is complete without a txHash', () => {
      it('should not put any new action', () => {
        return expectSaga(itemSaga, getIdentity)
          .dispatch(
            setPurchase({
              ...nftPurchase,
              txHash: null,
              status: PurchaseStatus.COMPLETE
            })
          )
          .run({ silenceTimeout: true })
          .then(({ effects }) => {
            expect(effects.put).toBeUndefined()
          })
      })
    })

    describe('when it is complete and it has a txHash', () => {
      const { contractAddress, itemId } = nftPurchase.nft

      describe('when the item does not yet exist in the store', () => {
        it('should put the action signaling the fetch item request', () => {
          return expectSaga(itemSaga, getIdentity)
            .provide([
              [select(getItems), {}],
              [matchers.put(fetchItemRequest(contractAddress, itemId!)), undefined]
            ])
            .put(fetchItemRequest(contractAddress, itemId!))
            .dispatch(
              setPurchase({
                ...nftPurchase,
                txHash,
                status: PurchaseStatus.COMPLETE
              })
            )
            .run({ silenceTimeout: true })
            .then(({ effects }) => {
              expect(effects.put).toBeUndefined()
            })
        })
      })

      describe('when the action of fetching the item has been dispatched', () => {
        describe('when the fetch item request fails', () => {
          it('should put an action signaling the failure of the buy item with card request', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [select(getItems), {}],
                [matchers.put(fetchItemRequest(contractAddress, itemId!)), undefined],
                [take(FETCH_ITEM_FAILURE), { payload: { error: anError.message } }]
              ])
              .put(fetchItemRequest(contractAddress, itemId!))
              .put(buyItemWithCardFailure(anError.message))
              .dispatch(
                setPurchase({
                  ...nftPurchase,
                  txHash,
                  status: PurchaseStatus.COMPLETE
                })
              )
              .run({ silenceTimeout: true })
          })
        })
      })

      describe('when the item already exists in the store', () => {
        const items = { anItemId: item }

        it('should put an action signaling the success of the buy item with card request', () => {
          return expectSaga(itemSaga, getIdentity)
            .provide([
              [select(getItems), items],
              [call(getItem, contractAddress, itemId!, items), item]
            ])
            .put(
              buyItemWithCardSuccess(item.chainId, txHash, item, {
                ...nftPurchase,
                status: PurchaseStatus.COMPLETE
              })
            )
            .dispatch(
              setPurchase({
                ...nftPurchase,
                txHash,
                status: PurchaseStatus.COMPLETE
              })
            )
            .run({ silenceTimeout: true })
        })
      })
    })
  })
})

describe('when handling the fetch collections items request action', () => {
  describe('when the request is successful', () => {
    const fetchResult = { data: [item] }

    it('should dispatch a successful action with the fetched items from marketplace server api', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getIsOffchainPublicItemOrdersEnabled), true],
          [matchers.call.fn(ItemAPI.prototype.get), fetchResult]
        ])
        .call.like({
          fn: ItemAPI.prototype.get,
          args: [{ first: 10, contractAddresses: [] }]
        })
        .put(fetchCollectionItemsSuccess(fetchResult.data))
        .dispatch(fetchCollectionItemsRequest({ contractAddresses: [], first: 10 }))
        .run({ silenceTimeout: true })
    })
  })

  describe('when the request fails', () => {
    it('should dispatch a failing action with the error and the options', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getIsOffchainPublicItemOrdersEnabled), true],
          [matchers.call.fn(ItemAPI.prototype.get), Promise.reject(anError)]
        ])
        .put(fetchCollectionItemsFailure(anError.message))
        .dispatch(fetchCollectionItemsRequest({ contractAddresses: [], first: 10 }))
        .run({ silenceTimeout: true })
    })
  })
})

describe('when handling the fetch items request action', () => {
  describe('when the request is successful', () => {
    let pathname: string
    let dateNowSpy: jest.SpyInstance
    const nowTimestamp = 1487076708000
    const fetchResult = { data: [item], total: 1 }

    beforeEach(() => {
      dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp)
    })

    afterEach(() => {
      dateNowSpy.mockRestore()
    })

    describe('and its dispatched from the browse path', () => {
      beforeEach(() => {
        pathname = locations.browse()
      })
      describe('and there is an ongoing fetch item request', () => {
        let wallet: Wallet | undefined
        const originalBrowseOptions = itemBrowseOptions
        const newBrowseOptions: ItemBrowseOptions = {
          ...itemBrowseOptions,
          filters: { ...itemBrowseOptions.filters, rarities: [Rarity.COMMON] }
        }
        describe('and there is a wallet connected', () => {
          beforeEach(() => {
            wallet = {} as Wallet
          })

          it('should dispatch a successful action with the fetched items and cancel the ongoing one', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
                [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
                [select(getWallet), wallet],
                [select(getIsOffchainPublicItemOrdersEnabled), true],
                [select(getIsOffchainPublicNFTOrdersEnabled), false],
                [select(getIsMarketplaceServerEnabled), true],
                [getContext('history'), { location: { pathname } }],
                {
                  call(effect, next) {
                    if (effect.fn === CatalogAPI.prototype.get && effect.args[0] === originalBrowseOptions.filters) {
                      // Add a setTimeout so it gives time to get it cancelled
                      return new Promise(() => {})
                    }
                    if (effect.fn === CatalogAPI.prototype.get && effect.args[0] === newBrowseOptions.filters) {
                      // Mock without timeout
                      return fetchResult
                    }
                    return next()
                  }
                }
              ])
              .call.like({
                fn: CatalogAPI.prototype.get,
                args: [newBrowseOptions.filters]
              })
              .put(fetchItemsFailure(FETCH_ITEMS_CANCELLED_ERROR_MESSAGE, originalBrowseOptions))
              .put(fetchItemsSuccess(fetchResult.data, fetchResult.total, newBrowseOptions, nowTimestamp))
              .dispatch(fetchItemsRequest(originalBrowseOptions))
              .dispatch({ type: CANCEL_FETCH_ITEMS })
              .dispatch(fetchItemsRequest(newBrowseOptions))
              .run({ silenceTimeout: true })
          })
        })

        describe('and there is no wallet connected', () => {
          it('should dispatch a successful action with the fetched items and cancel the ongoing one', () => {
            return expectSaga(itemSaga, getIdentity)
              .provide([
                [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
                [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
                [select(getWallet), wallet],
                [select(getIsOffchainPublicItemOrdersEnabled), true],
                [select(getIsOffchainPublicNFTOrdersEnabled), false],
                [select(getIsMarketplaceServerEnabled), true],
                [getContext('history'), { location: { pathname } }],
                {
                  call(effect, next) {
                    if (effect.fn === CatalogAPI.prototype.get && effect.args[0] === originalBrowseOptions.filters) {
                      // Add a setTimeout so it gives time to get it cancelled
                      return new Promise(() => {})
                    }
                    if (effect.fn === CatalogAPI.prototype.get && effect.args[0] === newBrowseOptions.filters) {
                      // Mock without timeout
                      return fetchResult
                    }
                    return next()
                  }
                }
              ])
              .call.like({
                fn: CatalogAPI.prototype.get,
                args: [newBrowseOptions.filters]
              })
              .put(fetchItemsFailure(FETCH_ITEMS_CANCELLED_ERROR_MESSAGE, originalBrowseOptions))
              .put(fetchItemsSuccess(fetchResult.data, fetchResult.total, newBrowseOptions, nowTimestamp))
              .dispatch(fetchItemsRequest(originalBrowseOptions))
              .dispatch({ type: CANCEL_FETCH_ITEMS })
              .dispatch(fetchItemsRequest(newBrowseOptions))
              .run({ silenceTimeout: true })
          })
        })
      })
    })

    describe('and its dispatches from a path that is not the browse', () => {
      beforeEach(() => {
        pathname = locations.root()
      })
      it('should dispatch a successful action with the fetched items', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [matchers.call.fn(CatalogAPI.prototype.get), fetchResult],
            [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
            [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
            [select(getIsOffchainPublicItemOrdersEnabled), true],
            [select(getIsOffchainPublicNFTOrdersEnabled), false],
            [select(getWallet), undefined],
            [getContext('history'), { location: { pathname } }],
            [select(getIsMarketplaceServerEnabled), false]
          ])
          .put(fetchItemsSuccess(fetchResult.data, fetchResult.total, itemBrowseOptions, nowTimestamp))
          .dispatch(fetchItemsRequest(itemBrowseOptions))
          .run({ silenceTimeout: true })
      })
    })
  })

  describe('when the request fails', () => {
    it('should dispatch a failing action with the error and the options', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [getContext('history'), { location: { pathname: '' } }],
          [select(getWallet), undefined],
          [select(getIsMarketplaceServerEnabled), true],
          [select(getIsOffchainPublicNFTOrdersEnabled), false],
          [select(getIsOffchainPublicItemOrdersEnabled), true],
          [select(getWallet), undefined],
          [matchers.call.fn(CatalogAPI.prototype.get), Promise.reject(anError)],
          [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
          [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined]
        ])
        .put(fetchItemsFailure(anError.message, itemBrowseOptions))
        .dispatch(fetchItemsRequest(itemBrowseOptions))
        .run({ silenceTimeout: true })
    })
  })

  describe('when handling the fetch item request action', () => {
    describe('when the request is successful', () => {
      describe('and it is a regular item', () => {
        it('should dispatch a successful action with the fetched items', () => {
          return expectSaga(itemSaga, getIdentity)
            .provide([
              [matchers.call.fn(ItemAPI.prototype.getOne), item],
              [matchers.call.fn(PeerAPI.prototype.fetchItemByUrn), entity],
              [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
              [select(getIsOffchainPublicItemOrdersEnabled), true]
            ])
            .put(fetchItemSuccess({ ...item, entity }))
            .dispatch(fetchItemRequest(item.contractAddress, item.itemId))
            .run({ silenceTimeout: true })
        })
      })

      describe('and it is a smart wearable', () => {
        let smartWearable: Item
        beforeEach(() => {
          smartWearable = {
            ...item,
            data: {
              ...item.data,
              wearable: {
                isSmart: true
              }
            },
            urn: 'someUrn'
          } as Item
        })

        it('should dispatch a successful action with the fetched items', () => {
          return expectSaga(itemSaga, getIdentity)
            .provide([
              [matchers.call.fn(ItemAPI.prototype.getOne), smartWearable],
              [matchers.call.fn(PeerAPI.prototype.fetchItemByUrn), entity],
              [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
              [select(getIsOffchainPublicItemOrdersEnabled), true]
            ])
            .put(fetchItemSuccess({ ...smartWearable, entity }))
            .put(fetchSmartWearableRequiredPermissionsRequest(smartWearable))
            .dispatch(fetchItemRequest(smartWearable.contractAddress, smartWearable.itemId))
            .run({ silenceTimeout: true })
        })
      })
    })

    describe('when the request fails', () => {
      it('should dispatching a failing action with the contract address, the token id and the error message', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [matchers.call.fn(ItemAPI.prototype.getOne), Promise.reject(anError)],
            [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined],
            [select(getIsOffchainPublicItemOrdersEnabled), true]
          ])
          .put(fetchItemFailure(item.contractAddress, item.itemId, anError.message))
          .dispatch(fetchItemRequest(item.contractAddress, item.itemId))
          .run({ silenceTimeout: true })
      })
    })
  })
})

describe('when handling the fetch trending items request action', () => {
  describe('when the request is successful', () => {
    describe('and there are some trending items', () => {
      let dateNowSpy: jest.SpyInstance
      const nowTimestamp = 1487076708000
      const fetchResult = { data: [item], total: 1 }

      beforeEach(() => {
        dateNowSpy = jest.spyOn(Date, 'now').mockImplementation(() => nowTimestamp)
      })

      afterEach(() => {
        dateNowSpy.mockRestore()
      })

      it('should dispatch a successful action with the fetched trending items', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
            [select(getIsMarketplaceServerEnabled), true],
            [select(getIsOffchainPublicNFTOrdersEnabled), false],
            [matchers.call.fn(ItemAPI.prototype.getTrendings), fetchResult],
            [matchers.call.fn(CatalogAPI.prototype.get), fetchResult],
            [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined]
          ])
          .put(fetchTrendingItemsSuccess(fetchResult.data))
          .dispatch(fetchTrendingItemsRequest())
          .run({ silenceTimeout: true })
      })
    })

    describe('and there are no trending items', () => {
      const fetchResult = { data: [], total: 0 }

      it('should dispatch a successful action with the fetched trending items', () => {
        return expectSaga(itemSaga, getIdentity)
          .provide([
            [select(getIsMarketplaceServerEnabled), true],
            [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
            [matchers.call.fn(ItemAPI.prototype.getTrendings), fetchResult],
            [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined]
          ])
          .put(fetchTrendingItemsSuccess(fetchResult.data))
          .dispatch(fetchTrendingItemsRequest())
          .run({ silenceTimeout: true })
      })
    })
  })

  describe('when the request fails', () => {
    it('should dispatch a failing action with the error and the options', () => {
      return expectSaga(itemSaga, getIdentity)
        .provide([
          [select(getIsMarketplaceServerEnabled), true],
          [matchers.call.fn(waitForFeatureFlagsToBeLoaded), undefined],
          [matchers.call.fn(ItemAPI.prototype.getTrendings), Promise.reject(anError)],
          [matchers.call.fn(waitForWalletConnectionAndIdentityIfConnecting), undefined]
        ])
        .put(fetchTrendingItemsFailure(anError.message))
        .dispatch(fetchTrendingItemsRequest())
        .run({ silenceTimeout: true })
    })
  })
})
