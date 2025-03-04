import { connect } from 'react-redux'
import { isLoadingType } from 'decentraland-dapps/dist/modules/loading/selectors'
import { fetchCreatorsAccountRequest, FETCH_CREATORS_ACCOUNT_REQUEST } from '../../../modules/account/actions'
import { getCreators, getLoading } from '../../../modules/account/selectors'
import { getIsOffchainPublicNFTOrdersEnabled } from '../../../modules/features/selectors'
import { RootState } from '../../../modules/reducer'
import { SearchBarDropdown } from './SearchBarDropdown'
import { MapDispatch, MapDispatchProps, MapStateProps } from './SearchBarDropdown.types'

const mapState = (state: RootState): MapStateProps => ({
  fetchedCreators: getCreators(state),
  isLoadingCreators: isLoadingType(getLoading(state), FETCH_CREATORS_ACCOUNT_REQUEST),
  isOffchainEnabled: getIsOffchainPublicNFTOrdersEnabled(state)
})

const mapDispatch = (dispatch: MapDispatch): MapDispatchProps => ({
  onFetchCreators: (search: string, searchUUID?: string) => dispatch(fetchCreatorsAccountRequest(search, searchUUID))
})

export default connect(mapState, mapDispatch)(SearchBarDropdown)
