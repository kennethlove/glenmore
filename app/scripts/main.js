/* Difference Scoring:
 *
 * 1 -> 1
 * 2 -> 2
 * 3 -> 3
 * 4 -> 5
 * 5+ -> 8
 *
*/

var GlenMore= new Marionette.Application();

GlenMore.addRegions({
    mainRegion: '#main',
    tabs: '#tabs',
    forms: '#forms'
});

GlenMore.User = Backbone.Model.extend({
    defaults: {
        name: 'William Wallace',
        slug: 'william-wallace',
        scores: {
            rounds: [
                {
                    whiskey: 0,
                    tams: 0,
                    locations: 0
                },
                {
                    whiskey: 0,
                    tams: 0,
                    locations: 0
                },
                {
                    whiskey: 0,
                    tams: 0,
                    locations: 0
                },
            ],
            final: {
                special: 0,
                coins: 0,
                tiles: 0
            }
        }
    }
});

GlenMore.Users = Backbone.Collection.extend({
    model: GlenMore.User
});

GlenMore.TabView = Marionette.ItemView.extend({
    template: '#tab_template',
    tagName: 'li',
});

GlenMore.UserTabs = Marionette.CollectionView.extend({
    itemView: GlenMore.TabView,
    tagName: 'ul',
    className: 'nav nav-tabs'
});

GlenMore.FormView = Marionette.ItemView.extend({
    template: '#form_template',
    className: 'tab-pane',
    id: function() {
        return 'user-' + this.model.escape('slug')
    },
    events: {
        'click .btn': 'saveRoundForm',
        'submit form': 'saveRoundForm'
    },
    saveRoundForm: function(e) {
        e.stopPropagation();
        e.preventDefault();
        alert(this.model.escape('name'));
    }
});

GlenMore.UserForms = Marionette.CollectionView.extend({
    itemView: GlenMore.FormView,
    tagName: 'div',
    className: 'tab-content'
});

GlenMore.on('initialize:after', function() {
    var kenneth = new GlenMore.User({
        name: 'Kenneth Love',
        slug: 'kenneth-love'
    });
    var elaine = new GlenMore.User({
        name: 'Elaine Love',
        slug: 'elaine-love'
    });
    var users = new GlenMore.Users([kenneth, elaine]);

    var tabsView = new GlenMore.UserTabs({
        collection: users
    });
    var formsView = new GlenMore.UserForms({
        collection: users
    });
    var williamFormView = new GlenMore.FormView({
        model: kenneth
    });
    GlenMore.tabs.show(tabsView);
    GlenMore.forms.show(formsView);
});

GlenMore.start();
