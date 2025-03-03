import { connect } from 'react-redux'
import { getMainTag } from 'decentraland-dapps/dist/modules/campaign/selectors'
import { getIsCampaignBrowserEnabled } from '../../../modules/features/selectors'
import { RootState } from '../../../modules/reducer'
import CampaignBadge from './CampaignBadge'
import { MapStateProps } from './CampaignBadge.types'

const mapState = (state: RootState): MapStateProps => ({
  isCampaignBrowserEnabled: getIsCampaignBrowserEnabled(state),
  campaignTag: getMainTag(state)
})

export default connect(mapState)(CampaignBadge)
