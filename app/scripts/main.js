/* Difference Scoring:
 *
 * 1 -> 1
 * 2 -> 2
 * 3 -> 3
 * 4 -> 5
 * 5+ -> 8
 *
*/

var GlenMore = new Marionette.Application();

GlenMore.addRegions({
    mainRegion: '#main',
    tabs: '#tabs',
    forms: '#forms',
    newuser: '#new_user'
});

GlenMore.Round = Backbone.RelationalModel.extend({
    defaults: {
        number: 1,
        whiskey: 0,
        tams: 0,
        locations: 0
    },
    relations: [{
        type: Backbone.HasOne,
        key: 'user',
        relatedModel: 'GlenMore.User'
    }]
});

GlenMore.FinalScoring = Backbone.Model.extend({
    defaults: {
        special: 0,
        coins: 0,
        tiles: 0
    }
});

GlenMore.Rounds = Backbone.Collection.extend({
//     localStorage: new Backbone.LocalStorage('glenmore-rounds'),
    model: GlenMore.Round
});

GlenMore.User = Backbone.RelationalModel.extend({
    defaults: {
        id: 0,
        name: 'William Wallace',
        slug: 'william-wallace'
    },
    relations: [{
        type: Backbone.HasMany,
        key: 'rounds',
        relatedModel: 'GlenMore.Round',
        collectionType: 'GlenMore.Rounds'
    }],
    initialize: function() {
        if (!this.get('rounds') || this.get('rounds').length === 0) {
            this.get('rounds').add(new GlenMore.Round({user: this}));
        }
    }
});

GlenMore.Users = Backbone.Collection.extend({
    localStorage: new Backbone.LocalStorage('glenmore-users'),
    model: GlenMore.User,
    save: function() {
        this.each(function(model) {
            Backbone.localSync('update', model);
        });
    },
    nextId: function() {
        if (!this.length) return 1;
        return this.last().get('id') + 1;
    }
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

GlenMore.AddUserTabView = Marionette.ItemView.extend({
    template: '#add_user_tab_template',
    tagName: 'li',
    className: 'add-user'
});

GlenMore.FormView = Marionette.ItemView.extend({
    template: '#form_template',
    className: 'tab-pane',
    id: function() {
        return 'user-' + this.model.escape('slug')
    },
    events: {
        'click .save-user': 'saveRoundForm',
        'submit form': 'saveRoundForm',
        'click .remove-user': 'removeUser'
    },
    saveRoundForm: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data['model'] = this.model;
        this.model.trigger('round_form:submit', data);
        $(e.target).parent('form').find(':submit').attr('disabled');
    },
    removeUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:remove', this.model);
    },
    template: function(serialized_model) {
        var template_html = $('#form_template').html();
        var context = {
            name: serialized_model.name,
            slug: serialized_model.slug,
            rounds: serialized_model.rounds,
            round: _.last(serialized_model.rounds)
        }
        return _.template(template_html, context);
    }
});

GlenMore.AddUserFormView = Marionette.ItemView.extend({
    template: '#add_user_form_template',
    className: 'tab-pane',
    id: 'add-user',
    events: {
        'click .btn': 'newUser',
        'submit form': 'newUser'
    },
    newUser: function(e) {
        e.preventDefault();
        var data = Backbone.Syphon.serialize(this);
        data.slug = data.name.split(' ').join('-').toLowerCase();
        this.trigger('form:submit', data);
        $(e.target).parent('form').find('input').val('');
    }
});

GlenMore.UserForms = Marionette.CollectionView.extend({
    itemView: GlenMore.FormView,
    tagName: 'div',
    className: 'tab-content',
});

GlenMore.Record = Marionette.ItemView.extend({
    tagName: 'tr',
    template: '#round_template'
});

GlenMore.Records = Marionette.CollectionView.extend({
    itemView: GlenMore.Record
});

GlenMore.on('initialize:after', function() {
    var users = new GlenMore.Users;
    users.fetch();
    users.on('add', function(user) {
        this.save();
    });
    users.on('user:remove', function(user) {
        deletedUser = this.get({'id': user.get('id')});
        deletedUser.destroy();
    });
    users.on('round_form:submit', function(data) {
        var user = this.get(data.model.get('id')),
            round = user.get('rounds').last();
        round.set({
            whiskey: parseInt(data.whiskey, 10) || 0,
            tams: parseInt(data.tams, 10) || 0,
            locations: parseInt(data.locations, 10) || 0
        });
        if (user.get('rounds').length <= 3) {
            user.get('rounds').add(new GlenMore.Round({
                number: round.get('number') + 1,
                user: user
            }));
        }
        this.save();
    });

    var tabsView = new GlenMore.UserTabs({
        collection: users
    });
    tabsView.on('collection:rendered', function() {
        this.$el.find('li:first').addClass('active');
    });
    
    var formsView = new GlenMore.UserForms({
        collection: users
    });
    formsView.on('collection:rendered', function() {
        this.$el.find('div.tab-pane:first').addClass('active');
    });

    var addUserForm = new GlenMore.AddUserFormView();

    addUserForm.on('form:submit', function(data) {
        data.id = users.nextId();
        users.add(data);
    });

    GlenMore.tabs.show(tabsView);
    GlenMore.forms.show(formsView);
    GlenMore.newuser.show(addUserForm);
});

GlenMore.start();
