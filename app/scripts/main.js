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
    forms: '#forms',
    newuser: '#new_user'
});

GlenMore.User = Backbone.Model.extend({
    defaults: {
        id: 0,
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
        e.stopPropagation();
        e.preventDefault();
        alert(this.model.escape('name'));
    },
    removeUser: function(e) {
        e.preventDefault();
        this.model.collection.trigger('user:remove', this.model);
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

    var tabsView = new GlenMore.UserTabs({
        collection: users
    });
    var formsView = new GlenMore.UserForms({
        collection: users
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
