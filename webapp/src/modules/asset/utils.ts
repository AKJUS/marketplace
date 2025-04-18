import { call, put, race, take } from 'redux-saga/effects'
import { NFTCategory, Order, RentalListing } from '@dcl/schemas'
import { SET_PURCHASE } from 'decentraland-dapps/dist/modules/gateway/actions'
import { CloseModalAction, CLOSE_MODAL, openModal } from 'decentraland-dapps/dist/modules/modal/actions'
import { t } from 'decentraland-dapps/dist/modules/translation/utils'
import { Wallet } from 'decentraland-dapps/dist/modules/wallet/types'
import { ContractData, ContractName, getContract } from 'decentraland-transactions'
import { NFT } from '../nft/types'
import { locations } from '../routing/locations'
import { openTransak } from '../transak/actions'
import { addressEquals } from '../wallet/utils'
import { Asset, AssetType } from './types'

export const BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY = 'buy-nfts-with-card-explanation-popup-key'

export function getAssetName(asset: Asset) {
  if (asset.name) {
    return asset.name
  }

  switch (asset.category) {
    case NFTCategory.PARCEL:
      return t('global.parcel_with_coords', (asset as NFT).data.parcel)

    case NFTCategory.ESTATE:
      return t('global.estate')

    case NFTCategory.WEARABLE:
      return t('global.wearable')

    case NFTCategory.ENS:
      return t('global.ens')

    default:
      return t('global.nft')
  }
}

export function getAssetImage(asset: Asset) {
  if ('image' in asset) {
    return asset.image
  }
  if ('thumbnail' in asset) {
    return asset.thumbnail
  }
  return ''
}

export function getAssetUrl(asset: Asset, isManager?: boolean) {
  if ('tokenId' in asset && !isManager) {
    return locations.nft(asset.contractAddress, asset.tokenId)
  }
  if ('tokenId' in asset && isManager) {
    return locations.manage(asset.contractAddress, asset.tokenId)
  }
  if ('itemId' in asset && asset.itemId !== null) {
    return locations.item(asset.contractAddress, asset.itemId)
  }
  return ''
}

export function getAssetPrice(asset: Asset, order?: Order) {
  return 'price' in asset ? (asset.isOnSale ? asset.price : null) : order ? order.price : null
}

export function isOwnedBy(asset: Asset, wallet: Wallet | null, rental?: RentalListing) {
  const assetAddress = 'owner' in asset ? asset.owner : asset.creator
  const isLoggedUserTheOwner = addressEquals(wallet?.address, assetAddress)
  // this also covers the case of the rental being OPEN, since the asset owner will be the
  if (!rental || isLoggedUserTheOwner) {
    return isLoggedUserTheOwner
  }

  // If the asset was transfered with an open listing, it will be change to CANCELLED
  // but rental lessor will still be the past owner.
  const rentalsContract: ContractData = getContract(ContractName.Rentals, (asset as NFT).chainId)
  const rentalContractHasTheAsset = rentalsContract.address === (asset as NFT).owner
  if (rental && rentalContractHasTheAsset) {
    // if the asset is not in the rental contracts, it has been transfered and should not have owner permissions
    return addressEquals(wallet?.address, rental?.lessor ?? undefined)
  }

  return false
}

export function isNFT(asset: Asset): asset is NFT {
  return 'tokenId' in asset
}

export function isCatalogItem(asset: Asset): boolean {
  return 'minPrice' in asset
}

export function isWearableOrEmote(asset: Asset): boolean {
  const categories: Array<typeof asset.category> = [NFTCategory.WEARABLE, NFTCategory.EMOTE]
  return categories.includes(asset.category)
}

export function* buyAssetWithCard(asset: Asset, order?: Order, useCredits: boolean = false) {
  const buyNftsWithCardExplanationPopupKey = (yield call(
    [localStorage, 'getItem'],
    BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY
  )) as ReturnType<typeof localStorage.getItem>

  if (buyNftsWithCardExplanationPopupKey === 'true') {
    yield put(openTransak(asset, order, useCredits))
    return
  }

  yield put(openModal('BuyWithCardExplanationModal', { asset, order }))

  const { close } = (yield race({
    continue: take(SET_PURCHASE),
    close: take(CLOSE_MODAL)
  })) as { close: CloseModalAction }

  if (close) {
    return
  }

  yield call([localStorage, 'setItem'], BUY_NFTS_WITH_CARD_EXPLANATION_POPUP_KEY, 'true')
}

export function mapAsset<T>(
  asset: Asset | null,
  itemMappers: {
    wearable: (asset: Asset<AssetType.ITEM>) => T
    emote: (asset: Asset<AssetType.ITEM>) => T
  },
  nftMappers: {
    wearable: (asset: Asset<AssetType.NFT>) => T
    emote: (asset: Asset<AssetType.NFT>) => T
    parcel: (asset: Asset<AssetType.NFT>) => T
    estate: (asset: Asset<AssetType.NFT>) => T
    ens: (asset: Asset<AssetType.NFT>) => T
  },
  fallback: () => T
) {
  if (!asset) {
    return fallback()
  }

  if (isNFT(asset)) {
    const nft = asset
    const { parcel, estate, wearable, emote, ens } = nft.data

    if (parcel) {
      return nftMappers.parcel(nft)
    }

    if (estate) {
      return nftMappers.estate(nft)
    }

    if (wearable) {
      return nftMappers.wearable(nft)
    }

    if (ens) {
      return nftMappers.ens(nft)
    }

    if (emote) {
      return nftMappers.emote(nft)
    }
  } else {
    const item = asset
    const { wearable, emote } = item.data

    if (wearable) {
      return itemMappers.wearable(item)
    }

    if (emote) {
      return itemMappers.emote(item)
    }
  }

  return fallback() // this is unreachable
}
