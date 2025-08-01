import { EmotePlayMode, GenderFilterOption, NFTCategory, Rarity, WearableGender } from '@dcl/schemas'
import { Network } from '@dcl/schemas/dist/dapps/network'
import { BarChartSource } from 'decentraland-ui/lib/components/BarChart/BarChart.types'
import { AssetType } from '../../../modules/asset/types'
import { BrowseOptions } from '../../../modules/routing/types'
import { LANDFilters } from '../../Vendor/decentraland/types'

export type Props = {
  section: string
  category?: NFTCategory
  assetType?: AssetType
  minPrice: string
  maxPrice: string
  network?: Network
  rarities: Rarity[]
  values?: BrowseOptions
  bodyShapes?: (GenderFilterOption | WearableGender)[]
  emotePlayMode?: EmotePlayMode[]
  isOnlySmart?: boolean
  landStatus: LANDFilters
  onChange: (value: [string, string], source: BarChartSource) => void
  defaultCollapsed?: boolean
  collection?: string
  minDistanceToPlaza?: string
  maxDistanceToPlaza?: string
  adjacentToRoad?: boolean
  minEstateSize?: string
  maxEstateSize?: string
  rentalDays?: number[]
  isRentalPriceFitlerChartEnabled?: boolean
  emoteHasGeometry?: boolean
  emoteHasSound?: boolean
  isOffchainPublicItemOrdersEnabled: boolean
  isOffchainPublicNFTOrdersEnabled: boolean
  isLoadingFeatureFlags: boolean
}

export type MapStateProps = Pick<
  Props,
  | 'section'
  | 'category'
  | 'assetType'
  | 'rarities'
  | 'bodyShapes'
  | 'isOnlySmart'
  | 'landStatus'
  | 'emotePlayMode'
  | 'collection'
  | 'network'
  | 'adjacentToRoad'
  | 'minEstateSize'
  | 'maxEstateSize'
  | 'minDistanceToPlaza'
  | 'maxDistanceToPlaza'
  | 'rentalDays'
  | 'isRentalPriceFitlerChartEnabled'
  | 'emoteHasGeometry'
  | 'emoteHasSound'
  | 'isOffchainPublicItemOrdersEnabled'
  | 'isOffchainPublicNFTOrdersEnabled'
  | 'isLoadingFeatureFlags'
>

export type OwnProps = Pick<Props, 'values'>
